"""Fill the database with demo data for the SIH demo.

    python seed.py                # seed (does nothing if the demo data is already there)
    python seed.py --reset        # remove the demo data, then seed it again
    python seed.py --clear        # only remove the demo data
    python seed.py --reset --yes  # same as --reset, without the confirmation prompt

Everything goes through the same service code as real requests: signup, profile update,
PDF upload (so ML /extract tags the startups), problem creation, solution submission (so
/summarize and the eligibility engine run), one /rank per problem, then one active pilot
(evaluator rubric, officer approval, a verified and a submitted milestone), and one procured
pilot that is now a proven solution with a pending replication request. If the ML service
is down, everything is still seeded and the ML fields stay pending; run `python retry_ml.py`
once it's up to fill them in.

Seeded accounts all have emails ending in @samarth.demo, which is how --reset/--clear find
them. Nothing else in the database is touched, except (via ON DELETE CASCADE) any other
startup's proposal on a seeded problem.
"""

import argparse
import sys
import textwrap
from dataclasses import dataclass, field
from datetime import date, timedelta
from io import BytesIO

import httpx
from fastapi import HTTPException, UploadFile
from sqlalchemy import delete, or_, select
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models import (
    EligibilityCheck,
    Pilot,
    ProcurementRecord,
    Problem,
    ProvenSolution,
    ReplicationRequest,
    SolutionAbstract,
    StartupDocument,
    StartupProfile,
    User,
)
from app.schemas.auth import SignupRequest
from app.schemas.pilot import DeliverableSubmit, MilestoneVerify, PilotCreate
from app.schemas.problem import ProblemCreate
from app.schemas.scale import ReplicationCreate
from app.schemas.solution import RubricIn, SolutionSubmit
from app.schemas.startup import StartupProfileUpdate
from app.services import (
    auth_service,
    ml_sync,
    pilot_service,
    problem_service,
    scale_service,
    solution_service,
    startup_service,
)
from app.services.ml_client import MLUnavailable
from app.services.uploads import delete_upload

EMAIL_DOMAIN = "samarth.demo"
PASSWORD = "Samarth@2026"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


# ============================================================================================
# Demo data
# ============================================================================================

GOV_USERS = [
    {
        "key": "agri",
        "role": "govt_officer",
        "name": "Dr. Anjali Mehra",
        "orgName": "Ministry of Agriculture & Farmers Welfare",
        "department": "Department of Agriculture & Farmers Welfare",
        "email": f"officer.agri@{EMAIL_DOMAIN}",
    },
    {
        "key": "urban",
        "role": "govt_officer",
        "name": "Vikram Rao",
        "orgName": "Ministry of Housing & Urban Affairs",
        "department": "Swachh Bharat Mission (Urban) Directorate",
        "email": f"officer.urban@{EMAIL_DOMAIN}",
    },
    {
        "key": "evaluator",
        "role": "evaluator",
        "name": "Prof. Meera Iyer",
        "orgName": "Independent Technical Evaluation Panel",
        "department": "Technology Assessment Cell",
        "email": f"evaluator@{EMAIL_DOMAIN}",
    },
]


@dataclass
class Doc:
    filename: str
    title: str
    body: str


@dataclass
class StartupSeed:
    key: str
    name: str  # contact person
    org_name: str
    email: str
    dpiit: str
    verified: bool
    turnover_band: str
    location: str
    incorporation_year: int
    description: str
    team: str  # reused in every proposal PDF
    docs: list[Doc] = field(default_factory=list)


STARTUPS = [
    StartupSeed(
        key="krishinetra",
        name="Aditya Kulkarni",
        org_name="KrishiNetra Vision Pvt Ltd",
        email=f"krishinetra@{EMAIL_DOMAIN}",
        dpiit="DIPP41872",
        verified=True,
        turnover_band="₹1Cr–₹5Cr",
        location="Pune, Maharashtra",
        incorporation_year=2021,
        description=(
            "Agricultural computer vision company building smartphone and field-camera tools that "
            "detect crop pests and diseases early for smallholder farmers and FPOs."
        ),
        team=(
            "KrishiNetra Vision has 18 staff: 6 machine learning engineers, 4 agronomists with plant "
            "pathology backgrounds, a field operations team of 5 in Nashik and Satara, and a 3-person "
            "Android team. Advisors include a retired principal scientist from ICAR-NRRI Cuttack."
        ),
        docs=[
            Doc(
                "krishinetra_paddy_blast_pilot_2024.pdf",
                "Project Report: Smartphone Detection of Paddy Blast and Brown Spot - Kharif 2024",
                """
Agriculture context. Paddy blast (Magnaporthe oryzae) and brown spot (Bipolaris oryzae) cause yield
losses of 10 to 30 percent for smallholder rice farmers in Maharashtra, Odisha and Chhattisgarh. Farmers
usually notice symptoms only after lesions spread across the canopy, by which time fungicide spraying is
late and expensive. Krishi Vigyan Kendra staff cannot visit every village during the kharif season.

Project goal. In partnership with two Farmer Producer Organisations in Nashik and Bhandara districts we
deployed a smartphone crop disease detection app to 2,140 paddy farmers across 61 villages during kharif
2024. Farmers photograph a leaf, and an on-device convolutional neural network classifies it into healthy,
leaf blast, neck blast, brown spot, bacterial leaf blight or sheath blight, and returns an agronomic
advisory in Marathi or Hindi with the recommended fungicide dose and spray window.

Model and data. The classifier is a MobileNetV3 model fine-tuned on 48,000 labelled field images
collected with agronomists from ICAR-NRRI protocols, augmented for varied lighting and backgrounds. The
model runs offline on entry-level Android phones (2 GB RAM) in under 400 ms. Images and GPS points sync
when connectivity returns and feed a district-level disease heat map for the agriculture department.

Results. Field-validated accuracy against agronomist diagnosis was 91.4 percent across 3,860 samples.
Median time from first symptom to advisory dropped from 9 days to 2 days. Participating farmers reduced
fungicide sprays by 1.3 rounds per season and reported an average yield gain of 6.8 percent over control
villages. The district agriculture office used the heat map to target 14 village-level awareness camps.

Technology readiness. The system has been operated by farmers in real field conditions for a full
season (TRL-7). Next steps are integration with state agriculture department advisory portals and
extension to wheat rust and cotton pink bollworm.
""",
            ),
            Doc(
                "krishinetra_tomato_leaf_curl_early_warning.pdf",
                "Technical Note: Early Warning for Tomato Leaf Curl Virus in FPO Clusters",
                """
Agriculture context. Tomato leaf curl virus, spread by whitefly, is the most damaging disease of tomato
in the Deccan plateau. Growers in Satara and Kolar lose entire plots when infection starts at the nursery
stage. Early rouging of infected seedlings and whitefly management can contain outbreaks if they are
detected within the first two weeks.

Approach. We installed 40 low-cost field cameras on yellow sticky traps across 12 tomato farms belonging
to a horticulture FPO. An object detection model counts whitefly on the traps every six hours, and the
count is combined with temperature, humidity and crop stage to forecast leaf curl risk for each farm. When
risk crosses a threshold, farmers and the FPO agronomist receive an SMS advisory.

Outcome. Over two seasons the warning system flagged 19 outbreaks an average of 8 days before visible
symptoms. Farms following the advisory recorded 42 percent lower plant loss than neighbouring farms. The
model and advisory logic are being extended to chilli and brinjal for the same FPO network.
""",
            ),
        ],
    ),
    StartupSeed(
        key="bhoomisense",
        name="Harpreet Kaur",
        org_name="BhoomiSense IoT Solutions",
        email=f"bhoomisense@{EMAIL_DOMAIN}",
        dpiit="DPIIT20931",
        verified=True,
        turnover_band="₹5Cr–₹25Cr",
        location="Ludhiana, Punjab",
        incorporation_year=2019,
        description=(
            "Agricultural IoT company making solar-powered soil moisture and micro-climate sensor networks "
            "for irrigation scheduling and crop advisory."
        ),
        team=(
            "BhoomiSense has 34 staff including 8 embedded and hardware engineers, 5 data scientists, 6 "
            "agronomists and soil scientists trained at PAU Ludhiana, and a 12-person installation and "
            "maintenance crew. Sensors are manufactured at our facility in the Ludhiana industrial area."
        ),
        docs=[
            Doc(
                "bhoomisense_lorawan_soil_moisture_canal_command.pdf",
                "Project Report: LoRaWAN Soil Moisture Network for Irrigation Scheduling, Sirhind Canal Command",
                """
Agriculture context. In the Sirhind canal command area of Punjab, farmers irrigate wheat and paddy by
calendar and by turn, often over-irrigating by 25 to 40 percent. Over-irrigation wastes canal water,
leaches nitrogen fertiliser and lifts the water table in tail-end villages, while head-end farmers draw
more than their share. The Water Resources and Agriculture departments wanted field-level evidence of
actual crop water need.

Solution. We installed 620 solar-powered capacitive soil moisture probes at 15, 30 and 60 cm depth
across 4,800 hectares of wheat and paddy in 22 villages. Probes report every 30 minutes over a LoRaWAN
network with 9 gateways. A crop water balance model combines soil moisture, crop stage, evapotranspiration
from local weather stations and the canal rotation schedule to issue an irrigation advisory to each farmer
in Punjabi by SMS and voice call: irrigate now, irrigate after 2 days, or skip this turn.

Results. Over two rabi and one kharif season, participating farmers applied 27 percent less irrigation
water with no loss of wheat yield (4.9 t/ha versus 4.8 t/ha in control fields). Pumping electricity use
fell 22 percent. Sensor uptime was 97.6 percent, and the average probe battery life exceeded 3 years.
Tail-end outlets received water 3 days earlier on average in the rotation.

Readiness. The network has operated at scale in farmers' fields for 18 months (TRL-7) and is maintained by
local technicians trained through the FPO.
""",
            ),
            Doc(
                "bhoomisense_microclimate_pest_risk_advisory.pdf",
                "Technical Note: Micro-climate Based Pest Risk Advisory for Cotton and Paddy",
                """
Agriculture context. Many crop pests and diseases are driven by leaf wetness, humidity and temperature.
Pink bollworm in cotton and blast in paddy both follow weather windows that can be forecast days ahead.

Approach. Our field micro-climate stations measure air temperature, relative humidity, leaf wetness
duration and rainfall at canopy height. Degree-day and disease risk models developed with PAU
entomologists compute daily pest risk indices for each village. Farmers receive a risk alert and
recommended scouting before spraying, which reduces calendar-based pesticide use.

Outcome. In 38 cotton villages of Bathinda the advisory reduced pesticide sprays by 2 rounds per season.
The same stations now run a paddy blast risk model in the canal command area. The advisory is weather
driven and does not include image-based diagnosis of symptoms.
""",
            ),
        ],
    ),
    StartupSeed(
        key="mandimitra",
        name="Sneha Deshpande",
        org_name="MandiMitra Agri Analytics",
        email=f"mandimitra@{EMAIL_DOMAIN}",
        dpiit="DIPP57306",
        verified=False,
        turnover_band="< ₹1Cr",
        location="Nagpur, Maharashtra",
        incorporation_year=2023,
        description=(
            "Agri-analytics startup giving Farmer Producer Organisations crop advisory, yield forecasts and "
            "mandi price intelligence over SMS and WhatsApp."
        ),
        team=(
            "MandiMitra is a team of 9: two data scientists, a full-stack developer, two agricultural "
            "economists and four field coordinators who work with FPO boards in Vidarbha."
        ),
        docs=[
            Doc(
                "mandimitra_fpo_cotton_advisory_yield_forecast.pdf",
                "Pilot Report: Crop Advisory and Yield Forecasting for Cotton FPOs in Vidarbha",
                """
Agriculture context. Rainfed cotton farmers in Vidarbha face erratic monsoons, volatile mandi prices and
limited access to agronomic advice. Farmer Producer Organisations need forecasts of how much cotton their
members will harvest to plan procurement, storage and sale.

Solution. MandiMitra combines sowing dates reported by farmers, district rainfall, soil type from the Soil
Health Card database and historical yields to forecast village-level cotton yield six weeks before
harvest. The platform sends weekly crop advisories on sowing, fertiliser and picking schedules, and daily
mandi price trends from Agmarknet, in Marathi over SMS and WhatsApp.

Results. Across 3 FPOs and 4,200 members, yield forecasts were within 11 percent of the actual harvest.
FPOs used the forecasts to book warehouse capacity in advance and to time sales, earning members an
average of Rs 310 per quintal above the local trader price. The platform is at pilot stage (TRL-5) with
FPO staff as the main users.
""",
            ),
        ],
    ),
    StartupSeed(
        key="punarchakra",
        name="Rohan Joshi",
        org_name="PunarChakra CleanTech",
        email=f"punarchakra@{EMAIL_DOMAIN}",
        dpiit="DPIIT33418",
        verified=True,
        turnover_band="₹1Cr–₹5Cr",
        location="Indore, Madhya Pradesh",
        incorporation_year=2020,
        description=(
            "Clean technology company building AI and RFID systems that monitor waste segregation and "
            "recycling for Urban Local Bodies and material recovery facilities."
        ),
        team=(
            "PunarChakra has 22 staff: 7 computer vision and embedded engineers, 4 solid waste management "
            "specialists who previously worked with Indore Municipal Corporation, and 11 field staff who "
            "install and maintain equipment on collection vehicles and at MRFs."
        ),
        docs=[
            Doc(
                "punarchakra_ai_camera_mrf_audit_indore.pdf",
                "Project Report: AI Vision for Waste Segregation and Recycling Recovery at Material Recovery Facilities",
                """
Clean technology context. Mixed solid waste is one of India's largest sources of environmental pollution:
contaminated recyclables end up in landfills and open dumps, where rotting organic waste emits methane and
leachate pollutes groundwater. Plastic, paper, glass and metal can only be recycled, and organic waste can
only be composted or turned into biogas, if the streams are kept clean. Contamination at the source
destroys the value of recyclables and the quality of compost, and pushes the circular economy backwards.

Solution. We mounted rugged cameras over the unloading bays and conveyor belts of 3 material recovery
facilities in Indore. A computer vision model trained on 120,000 annotated waste images measures the
contamination of every load: the share of plastic, glass, metal and organic waste found in the wrong
stream. Each collection vehicle carries an RFID tag, so poorly segregated loads are traced back to their
collection route and ward for targeted awareness drives.

Results. Over 14 months the system audited 186,000 vehicle loads. Properly segregated loads rose from 71 to
89 percent. Recyclable recovery at the MRFs increased 18 percent, compost rejects fell by a third, and
about 4,200 tonnes of waste were diverted from landfill, avoiding an estimated 3,100 tonnes of CO2
equivalent emissions. The system has operated continuously in a live facility (TRL-7).
""",
            ),
            Doc(
                "punarchakra_nir_plastic_sorting.pdf",
                "Technical Note: Near-Infrared Sorting of Mixed Plastic Waste for Recycling",
                """
Clean technology context. Low-value multilayer and mixed plastics are rarely recycled in India because
manual sorting cannot separate polymer types reliably. Unsorted plastic is burnt or landfilled, causing air
pollution and microplastic contamination.

Approach. Our near-infrared (NIR) hyperspectral sensor identifies PET, HDPE, LDPE, PP and multilayer
packaging on a moving conveyor, and air jets eject each item into the right bale. The sorter is designed
for small recyclers and MRFs, costing a fraction of imported optical sorters.

Outcome. A pilot line at a dry waste recycling unit sorted 2.4 tonnes of plastic per shift at 94 percent
purity, doubling the recycler's recovery of saleable PET and HDPE and reducing rejects sent to cement kilns.
""",
            ),
        ],
    ),
    StartupSeed(
        key="jansetu",
        name="Imran Siddiqui",
        org_name="JanSetu Civic AI",
        email=f"jansetu@{EMAIL_DOMAIN}",
        dpiit="DIPP68245",
        verified=False,
        turnover_band="< ₹1Cr",
        location="Hyderabad, Telangana",
        incorporation_year=2022,
        description=(
            "GovTech startup building multilingual natural language processing for e-governance: grievance "
            "classification, routing and citizen service chatbots."
        ),
        team=(
            "JanSetu is a team of 11: 5 NLP engineers with experience in Indic language models, 3 backend "
            "engineers, a former municipal IT nodal officer as head of implementation, and 2 annotators."
        ),
        docs=[
            Doc(
                "jansetu_multilingual_grievance_classifier.pdf",
                "Project Report: Multilingual Grievance Classification and Routing for a Municipal e-Governance Portal",
                """
Governance context. Municipal corporations receive thousands of citizen grievances every week through
web portals, mobile apps, WhatsApp and call centres, written in Telugu, Hindi, Urdu and English, often
mixed in one message. Clerks read each grievance manually to assign it to a department such as roads,
water supply, sanitation, street lighting or town planning. Misrouted grievances bounce between offices
and breach the service level timelines of the public grievance redressal system.

Solution. JanSetu built a multilingual transformer classifier, fine-tuned from an Indic language model on
210,000 historical grievances labelled by municipal staff. It predicts the department, grievance category
and urgency, detects duplicates about the same location, and routes each grievance to the right ward
officer's queue in the e-governance portal through an API. Officers see the model's confidence and can
correct the routing, which feeds weekly retraining.

Results. In a 6-month deployment with a municipal corporation in Telangana handling 1,800 grievances a day,
routing accuracy was 88 percent on the first attempt, compared with 64 percent for manual routing. Average
time to assignment fell from 26 hours to under 1 hour, and grievances resolved within the service level
timeline increased from 58 to 81 percent. The system has been demonstrated in an operational e-governance
environment (TRL-6).
""",
            ),
        ],
    ),
]
STARTUPS_BY_KEY = {s.key: s for s in STARTUPS}


def _deadline(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


PROBLEMS = [
    {
        "key": "P1",
        "officer": "agri",
        "title": "Early detection of pest and disease outbreaks in smallholder paddy",
        "department": "Department of Agriculture & Farmers Welfare",
        "ministry": "Ministry of Agriculture & Farmers Welfare",
        "domain": "AgriTech",
        "description": (
            "Smallholder paddy farmers detect blast, brown spot, bacterial leaf blight and stem borer attacks "
            "only after significant crop damage. Extension staff cannot scout every field during kharif. The "
            "department seeks a low-cost tool that lets farmers or village-level extension workers identify "
            "paddy pests and diseases from symptoms in the field, works offline in local languages, and gives "
            "district officers an early-warning view of outbreaks."
        ),
        "desiredOutcome": (
            "At least 85% field-validated diagnosis accuracy for the top 6 paddy diseases and pests, advisory "
            "delivered within 24 hours of the first symptoms, and a district outbreak dashboard, piloted with "
            "2,000 farmers in one district over a kharif season."
        ),
        "budgetBand": "₹25L–₹50L",
        "targetTRL": "TRL-6",
        "deadline": _deadline(45),
    },
    {
        "key": "P2",
        "officer": "agri",
        "title": "Sensor-based irrigation scheduling for canal command areas",
        "department": "Department of Agriculture & Farmers Welfare",
        "ministry": "Ministry of Agriculture & Farmers Welfare",
        "domain": "AgriTech",
        "description": (
            "Farmers in canal command areas irrigate by calendar and turn, over-irrigating head-end fields "
            "while tail-end farmers get too little water. The department wants field-level soil moisture "
            "sensing and crop water requirement estimates that tell each farmer when to irrigate, aligned with "
            "the canal rotation schedule, to save water without reducing yield."
        ),
        "desiredOutcome": (
            "20% reduction in irrigation water applied with no yield loss, soil moisture data from at least 300 "
            "field sensors in one canal command area, and farmer advisories in the local language."
        ),
        "budgetBand": "₹10L–₹25L",
        "targetTRL": "TRL-5",
        "deadline": _deadline(60),
    },
    {
        "key": "P3",
        "officer": "urban",
        "title": "Monitoring source segregation of municipal solid waste",
        "department": "Swachh Bharat Mission (Urban) Directorate",
        "ministry": "Ministry of Housing & Urban Affairs",
        "domain": "CleanTech",
        "description": (
            "Urban Local Bodies lack reliable data on how well households and bulk waste generators segregate "
            "waste into wet, dry and hazardous streams. Mixed waste reaching material recovery facilities and "
            "compost plants lowers recycling rates and sends more waste to landfill. The Mission seeks a "
            "system that measures segregation quality automatically and traces poor segregation back to wards "
            "and collection routes."
        ),
        "desiredOutcome": (
            "Automated segregation scoring for at least 90% of collection vehicle loads in a pilot ULB, a "
            "ward-wise segregation dashboard, and a measurable increase in correctly segregated waste within "
            "6 months."
        ),
        "budgetBand": "₹10L–₹25L",
        "targetTRL": "TRL-6",
        "deadline": _deadline(30),
    },
    {
        "key": "P4",
        "officer": "urban",
        "title": "Multilingual AI triage of municipal citizen grievances",
        "department": "Swachh Bharat Mission (Urban) Directorate",
        "ministry": "Ministry of Housing & Urban Affairs",
        "domain": "GovTech",
        "description": (
            "Municipal grievance portals receive large volumes of complaints in multiple Indian languages. "
            "Manual reading and routing causes delays and misrouting between departments. The Ministry seeks "
            "an AI system that classifies grievances by department and urgency, detects duplicates and routes "
            "them automatically within existing e-governance portals."
        ),
        "desiredOutcome": (
            "85% correct first-time routing across at least 3 languages, assignment within 1 hour of filing, "
            "and integration with the ULB's existing grievance redressal portal through APIs."
        ),
        "budgetBand": "₹10L–₹25L",
        "targetTRL": "TRL-5",
        "deadline": _deadline(40),
    },
]


@dataclass
class SolutionSeed:
    problem: str
    startup: str
    title: str
    abstract: str
    approach: str
    plan: str
    claimed_trl: str
    cost: int  # rupees
    weeks: int


SOLUTIONS = [
    # --- P1 paddy pests: strong / medium / weak (and TRL too low) ---
    SolutionSeed(
        "P1", "krishinetra",
        "Offline smartphone diagnosis of paddy diseases and pests with district outbreak dashboard",
        "An on-device deep learning model identifies paddy blast, brown spot, bacterial leaf blight, sheath "
        "blight and stem borer damage from a leaf or tiller photo, offline, in local languages, and gives the "
        "farmer an advisory within minutes. Geotagged diagnoses feed a district outbreak early-warning "
        "dashboard for agriculture officers. Field-validated at 91% accuracy with 2,140 paddy farmers in "
        "kharif 2024.",
        "MobileNetV3 classifier running on entry-level Android phones, trained on 48,000 field images labelled "
        "with ICAR-NRRI protocols. Extension workers can use the same app for group diagnosis. Diagnoses sync "
        "when online and are aggregated by village into outbreak alerts with thresholds agreed with the "
        "district agriculture office.",
        "Weeks 1-4: localisation and onboarding of 40 village extension workers. Weeks 5-16: farmer rollout "
        "and kharif season operation. Weeks 17-20: validation against agronomist field diagnosis and final "
        "report with outbreak data.",
        "TRL-7", 3_800_000, 20,
    ),
    SolutionSeed(
        "P1", "bhoomisense",
        "Micro-climate pest and disease risk forecasting for paddy villages",
        "Canopy-level weather stations measuring leaf wetness, humidity and temperature feed degree-day and "
        "disease risk models that forecast blast and stem borer risk for each village several days ahead. "
        "Farmers and extension staff receive risk alerts and scouting reminders by SMS. The approach predicts "
        "outbreak risk from weather rather than diagnosing symptoms in the field.",
        "One micro-climate station per 3-4 villages, risk models calibrated with PAU entomologists, advisory "
        "delivery through our existing SMS and voice platform, and a district risk map.",
        "Weeks 1-6: installation of 30 stations. Weeks 7-18: kharif operation and alerts. Weeks 19-22: "
        "comparison of forecast risk with observed incidence.",
        "TRL-6", 2_900_000, 22,
    ),
    SolutionSeed(
        "P1", "mandimitra",
        "WhatsApp crop advisory service for paddy FPO members",
        "A WhatsApp and SMS advisory service for FPO members that sends weekly crop calendar messages, "
        "fertiliser schedules and mandi price updates, with a helpline where farmers can describe crop "
        "problems to an agronomist. Includes a basic dashboard of member queries for the FPO.",
        "Extends our cotton advisory platform to paddy crop calendars, with agronomists answering farmer "
        "queries forwarded through the helpline.",
        "Weeks 1-4: content preparation for paddy. Weeks 5-16: advisory operation with 2 FPOs. Weeks 17-18: "
        "member feedback survey.",
        "TRL-5", 1_200_000, 18,
    ),
    # --- P2 irrigation: strong / medium / weak-medium ---
    SolutionSeed(
        "P2", "bhoomisense",
        "LoRaWAN soil moisture sensor network with canal-rotation-aware irrigation advisories",
        "Solar-powered soil moisture probes at three depths report every 30 minutes over LoRaWAN. A crop water "
        "balance model combining soil moisture, evapotranspiration and the canal rotation schedule tells each "
        "farmer when to irrigate or skip a turn, in the local language by SMS and voice. Proven at scale in the "
        "Sirhind canal command: 27% less irrigation water with no yield loss across 4,800 hectares.",
        "350 probes and 5 gateways across one canal command area, integration with the irrigation "
        "department's rotation schedule, and a dashboard showing water saved per outlet.",
        "Weeks 1-6: sensor installation and farmer onboarding. Weeks 7-22: full rabi season operation. "
        "Weeks 23-24: water savings and yield assessment.",
        "TRL-7", 2_300_000, 24,
    ),
    SolutionSeed(
        "P2", "krishinetra",
        "Satellite and weather based crop water stress mapping for irrigation advisories",
        "Uses Sentinel-2 vegetation indices and land surface temperature with local weather forecasts to map "
        "crop water stress at field level every 5 days, and sends irrigation advisories to farmers. Needs no "
        "field hardware; accuracy is limited under cloud cover during the monsoon.",
        "Satellite processing pipeline estimating crop evapotranspiration and water stress, calibrated with a "
        "small number of field soil moisture readings, delivered through our existing farmer app.",
        "Weeks 1-8: calibration in one canal command. Weeks 9-20: advisory operation. Weeks 21-22: "
        "comparison with farmer irrigation records.",
        "TRL-5", 1_600_000, 22,
    ),
    SolutionSeed(
        "P2", "mandimitra",
        "Weather-based irrigation reminders for FPO members",
        "An SMS reminder service that tells FPO members when to irrigate based on crop stage and the rainfall "
        "forecast, bundled with our crop advisory and mandi price updates. Does not use field sensors.",
        "Rule-based irrigation calendar per crop and soil type, adjusted weekly with district rainfall "
        "forecasts, sent by SMS and WhatsApp.",
        "Weeks 1-4: crop calendar setup. Weeks 5-20: reminder service for 2 FPOs. Weeks 21-22: survey of "
        "member water use.",
        "TRL-5", 900_000, 22,
    ),
    # --- P3 waste segregation: strong / off-domain ---
    SolutionSeed(
        "P3", "punarchakra",
        "AI camera segregation scoring of every collection vehicle load, traced to ward via RFID",
        "Cameras over MRF unloading bays and conveyors use computer vision to score contamination in every "
        "collection vehicle load of wet, dry and hazardous waste. RFID tags on vehicles trace each load to its "
        "route and ward, producing a daily ward-wise segregation dashboard for the ULB. In Indore, 186,000 "
        "loads were audited and correctly segregated loads rose from 71% to 89%.",
        "Camera units at 2 MRFs and the transfer station, RFID tagging of the ULB's collection fleet, a "
        "contamination model fine-tuned on the pilot city's waste, and a dashboard for sanitation "
        "inspectors.",
        "Weeks 1-4: installation and fleet tagging. Weeks 5-8: model fine-tuning on local waste. Weeks "
        "9-24: operation and ward feedback drives. Weeks 25-26: impact report.",
        "TRL-7", 2_200_000, 26,
    ),
    SolutionSeed(
        "P3", "jansetu",
        "Citizen complaint chatbot for missed garbage collection",
        "A multilingual WhatsApp chatbot where citizens report missed garbage pickup or overflowing bins. "
        "Complaints are classified and routed to the sanitation inspector for the ward, and citizens get "
        "status updates when the complaint is resolved.",
        "Our grievance classification model adapted to sanitation complaints, connected to the ULB's "
        "grievance portal.",
        "Weeks 1-4: chatbot setup. Weeks 5-16: citizen rollout. Weeks 17-18: complaint trend report.",
        "TRL-6", 1_100_000, 18,
    ),
    # --- P4 grievance triage: strong ---
    SolutionSeed(
        "P4", "jansetu",
        "Multilingual transformer classifier for automatic grievance routing and duplicate detection",
        "An Indic-language transformer model classifies each citizen grievance by department, category and "
        "urgency in Telugu, Hindi, Urdu and English, including code-mixed text, detects duplicates about the "
        "same location, and routes it to the right officer through the portal's API. In a Telangana "
        "municipal corporation, first-time routing accuracy reached 88% and assignment time fell from 26 hours "
        "to under 1 hour.",
        "Fine-tuning on the pilot ULB's historical grievances, API integration with its grievance redressal "
        "portal, officer feedback loop for weekly retraining, and a supervisor dashboard.",
        "Weeks 1-4: data preparation and fine-tuning. Weeks 5-8: portal integration. Weeks 9-20: live "
        "operation. Weeks 21-22: evaluation against manual routing.",
        "TRL-6", 1_800_000, 22,
    ),
]


# ============================================================================================
# PDF generation
# ============================================================================================

# The one pilot: KrishiNetra's paddy diagnosis app on P1, approved by the agri officer after the
# evaluator scored it (so the officer, not the evaluator, verifies milestones: conflict of interest).
PILOT = {
    "problem": "P1",
    "startup": "krishinetra",
    "validator": "Dr. Sunita Sen (Senior Scientist, CSIR-NAL)",
    "rubric": {"technicalMerit": 27, "costRealism": 16, "teamCapability": 18, "timelineViability": 26,
               "comments": "Field-validated accuracy and a realistic kharif-season plan."},
    "milestones": [
        {"sequence": 1, "title": "Localisation and extension worker onboarding",
         "description": "App localised to Odia and Telugu; 40 village extension workers trained.",
         "targetKPI": "40 extension workers onboarded, app available in 2 local languages",
         "deliverableDueWeek": 4, "tranchePercentage": 25},
        {"sequence": 2, "title": "Kharif farmer rollout",
         "description": "Farmer onboarding in the pilot district and live diagnosis during kharif.",
         "targetKPI": "2,000 farmers onboarded; advisory within 24 h of first symptoms",
         "deliverableDueWeek": 12, "tranchePercentage": 45},
        {"sequence": 3, "title": "Field validation and outbreak dashboard handover",
         "description": "Accuracy validated against agronomist field diagnosis; dashboard handed to the district.",
         "targetKPI": ">= 85% field-validated accuracy on the top 6 paddy diseases and pests",
         "deliverableDueWeek": 20, "tranchePercentage": 30},
    ],
    "deliverables": {
        1: ("41 extension workers onboarded; Odia and Telugu builds live", "/deliverables/krishinetra-m1-onboarding.pdf"),
        2: ("2,214 farmers onboarded; median advisory time 6 h", "/deliverables/krishinetra-m2-rollout.pdf"),
    },
}


# The procured pilot: BhoomiSense's irrigation sensors on P2. Milestone 2 fails its first
# verification and passes on resubmission, so the performance score isn't a flat 100. Once
# procured, the urban officer asks to replicate it (left pending for the demo).
PROCURED_PILOT = {
    "problem": "P2",
    "startup": "bhoomisense",
    "validator": "Prof. K. Rao (Aerospace, IIT Delhi)",
    "rubric": {"technicalMerit": 26, "costRealism": 17, "teamCapability": 17, "timelineViability": 24,
               "comments": "Proven at scale in another canal command; realistic rabi-season plan."},
    "milestones": [
        {"sequence": 1, "title": "Sensor installation and farmer onboarding",
         "description": "350 soil moisture probes and 5 LoRaWAN gateways installed; farmers enrolled.",
         "targetKPI": "300+ probes reporting every 30 minutes",
         "deliverableDueWeek": 6, "tranchePercentage": 30},
        {"sequence": 2, "title": "Rabi season irrigation advisories",
         "description": "Canal-rotation-aware advisories by SMS and voice for the full rabi season.",
         "targetKPI": "Advisories to every enrolled farmer before each rotation",
         "deliverableDueWeek": 18, "tranchePercentage": 40},
        {"sequence": 3, "title": "Water savings and yield assessment",
         "description": "Irrigation water applied and yield compared against the previous rabi season.",
         "targetKPI": ">= 20% less irrigation water with no yield loss",
         "deliverableDueWeek": 24, "tranchePercentage": 30},
    ],
    "deliverables": {
        1: ("342 probes reporting; 1,180 farmers enrolled", "/deliverables/bhoomisense-m1-installation.pdf"),
        2: ("Advisories sent before 11 of 12 rotations", "/deliverables/bhoomisense-m2-advisories.pdf"),
        3: ("23% less irrigation water; yield within 1% of last season", "/deliverables/bhoomisense-m3-assessment.pdf"),
    },
    "m2_resubmission": ("Advisories sent before all 12 rotations after the gateway fix",
                        "/deliverables/bhoomisense-m2-advisories-v2.pdf"),
    "replication": {
        "officer": "urban",
        "requestingOfficerName": "Vikram Rao",
        "requestingOfficerEmail": f"officer.urban@{EMAIL_DOMAIN}",
        "targetDeploymentSite": "Nagpur peri-urban wastewater irrigation zone",
        "targetQuantity": 120,
        "targetBudget": 1_600_000,
        "deploymentTimelineWeeks": 16,
    },
}


def _latin1(text: str) -> str:
    # The built-in Helvetica font only covers Latin-1; swap the few characters we use.
    text = text.replace("₹", "Rs ").replace("–", "-").replace("—", "-").replace("’", "'")
    return text.encode("latin-1", "replace").decode("latin-1")


def _pdf_escape(line: str) -> str:
    return line.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def make_pdf(title: str, body: str) -> bytes:
    """A multi-page PDF with a real text layer (readable by pypdf and the ML service).
    Same construction as tests/helpers.py::text_pdf, plus word wrap, a bold title and pages."""
    lines: list[tuple[str, str]] = [("F2", ln) for ln in textwrap.wrap(_latin1(title), 70)] + [("F1", "")]
    for para in textwrap.dedent(body).strip().split("\n\n"):
        lines += [("F1", ln) for ln in textwrap.wrap(_latin1(" ".join(para.split())), 95)] + [("F1", "")]

    per_page = 60
    pages = [lines[i:i + per_page] for i in range(0, len(lines), per_page)]
    streams = []
    for page in pages:
        parts = ["BT 12 TL 50 800 Td"]
        for font, text in page:
            size = 13 if font == "F2" else 9.5
            parts.append(f"/{font} {size} Tf ({_pdf_escape(text)}) '")
        parts.append("ET")
        streams.append(" ".join(parts).encode("latin-1"))

    # Objects: 1 catalog, 2 pages, 3 Helvetica, 4 Helvetica-Bold, then (page, content) pairs.
    n_pages = len(pages)
    page_ids = [5 + 2 * i for i in range(n_pages)]
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [%s] /Count %d >>" % (b" ".join(b"%d 0 R" % p for p in page_ids), n_pages),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ]
    for pid, stream in zip(page_ids, streams):
        objects.append(
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents %d 0 R "
            b"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>" % (pid + 1)
        )
        objects.append(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")

    out, offsets = bytearray(b"%PDF-1.4\n"), []
    for n, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % n + obj + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % off for off in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return bytes(out)


def proposal_pdf(sol: SolutionSeed, startup: StartupSeed, problem_title: str) -> bytes:
    body = f"""
Submitted by {startup.org_name}, {startup.location} (DPIIT {startup.dpiit}) in response to the problem
statement "{problem_title}".

1. Summary. {sol.abstract}

2. Technical approach. {sol.approach}

3. Implementation plan. {sol.plan}

4. Team. {startup.team}

5. Cost and timeline. Total proposed cost is Rs {sol.cost:,} for a pilot of {sol.weeks} weeks, covering
hardware, deployment, field operations, cloud hosting and reporting. Claimed technology readiness level:
{sol.claimed_trl}.
"""
    return make_pdf(f"Solution Proposal: {sol.title}", body)


def upload(data: bytes, filename: str) -> UploadFile:
    # The same object FastAPI hands the endpoints, so save_pdf's checks run unchanged.
    return UploadFile(file=BytesIO(data), filename=filename)


# ============================================================================================
# Seed / clear
# ============================================================================================

def _log(msg: str) -> None:
    print(msg, flush=True)


def seeded_users_filter():
    return User.email.like(f"%@{EMAIL_DOMAIN}")


def is_seeded(db: Session) -> bool:
    return db.scalar(select(User.id).where(seeded_users_filter()).limit(1)) is not None


def ml_reachable() -> bool:
    try:
        return httpx.get(f"{get_settings().ml_service_url}/healthz", timeout=2.0).is_success
    except httpx.HTTPError:
        return False


def _signup(db: Session, body: dict) -> User:
    return auth_service.register_user(db, SignupRequest.model_validate({**body, "password": PASSWORD}))


def seed(db: Session) -> dict[str, Problem]:
    """Create all the demo data through the service layer. Returns the problems by key."""
    _log("Creating government accounts...")
    gov = {u["key"]: _signup(db, {k: v for k, v in u.items() if k != "key"}) for u in GOV_USERS}

    profiles: dict[str, StartupProfile] = {}
    for s in STARTUPS:
        _log(f"Creating startup {s.org_name} and uploading {len(s.docs)} document(s)...")
        user = _signup(db, {"role": "startup", "name": s.name, "orgName": s.org_name, "email": s.email,
                            "dpiitNumber": s.dpiit})
        profile = startup_service.get_profile(db, user.id)
        startup_service.update_profile(db, profile, StartupProfileUpdate(
            turnover_band=s.turnover_band,
            location=s.location,
            incorporation_year=s.incorporation_year,
            description=s.description,
        ))
        if s.verified:
            # Nothing in the app sets dpiit_verified yet (it'll be an admin action), so the
            # seed sets it directly to show both states in the UI.
            profile.dpiit_verified = True
            db.commit()
        # Documents go in before any submission, so /extract has classified the startup's
        # domain by the time eligibility first runs.
        for d in s.docs:
            result = startup_service.add_document(db, profile, upload(make_pdf(d.title, d.body), d.filename))
            _log(f"    {d.filename}: " + (f"domain {result.domain}" if result.extraction_status == "done"
                                            else "ML pending"))
        profiles[s.key] = profile

    _log("Posting problem statements...")
    problems: dict[str, Problem] = {}
    for p in PROBLEMS:
        body = {k: v for k, v in p.items() if k not in ("key", "officer")}
        problems[p["key"]] = problem_service.create_problem(db, gov[p["officer"]], ProblemCreate.model_validate(body))
        _log(f"    {problems[p['key']].code}  {p['title']}")

    _log("Submitting solutions (summarize + eligibility run on each)...")
    for sol in SOLUTIONS:
        startup, problem = STARTUPS_BY_KEY[sol.startup], problems[sol.problem]
        req = SolutionSubmit.model_validate({
            "title": sol.title,
            "abstract": sol.abstract,
            "claimedTRL": sol.claimed_trl,
            "proposedCost": sol.cost,
            "proposedDurationWeeks": sol.weeks,
        })
        pdf = upload(proposal_pdf(sol, startup, problem.title), f"{startup.key}_proposal_{sol.problem}.pdf")
        solution_service.submit_solution(db, profiles[sol.startup], problem, req, pdf)
        _log(f"    {problem.code} <- {startup.org_name}")

    _log("Ranking each problem's solutions...")
    for problem in problems.values():
        try:
            ml_sync.rank_problem(db, problem)
            _log(f"    {problem.code}: ranked")
        except MLUnavailable:
            _log(f"    {problem.code}: ML pending")

    seed_pilot(db, gov, profiles, problems)
    seed_procured_pilot(db, gov, profiles, problems)
    return problems


def seed_pilot(db: Session, gov: dict[str, User], profiles: dict[str, StartupProfile],
               problems: dict[str, Problem]) -> None:
    """One active pilot, built through the same service code the endpoints use."""
    problem = problems[PILOT["problem"]]
    officer = db.get(User, problem.posted_by)
    solution = db.scalar(select(SolutionAbstract).where(
        SolutionAbstract.problem_id == problem.id, SolutionAbstract.startup_id == profiles[PILOT["startup"]].id
    ))
    _log(f"Creating a pilot for {problem.code} <- {STARTUPS_BY_KEY[PILOT['startup']].org_name}...")
    solution_service.save_rubric(db, gov["evaluator"], solution, RubricIn.model_validate(PILOT["rubric"]))
    try:
        pilot_id = pilot_service.create_pilot(db, officer, PilotCreate.model_validate({
            "solutionId": str(solution.id),
            "independentValidatorName": PILOT["validator"],
            "durationWeeks": solution.proposed_duration_weeks,
            "totalBudget": solution.proposed_cost,
            "milestones": PILOT["milestones"],
        }))
    except HTTPException as e:  # e.g. ML classified the startup into another domain
        _log(f"    skipped: {e.detail}")
        return
    pilot = pilot_service.get_pilot(db, officer, str(pilot_id))
    pilot_service.update_status(db, officer, pilot, "Active")
    by_seq = {m.sequence: m.id for m in pilot.milestones}
    for seq, (kpi, url) in PILOT["deliverables"].items():
        pilot = pilot_service.get_pilot(db, officer, str(pilot_id))
        pilot_service.submit_deliverable(db, pilot, by_seq[seq], DeliverableSubmit(achieved_kpi=kpi, file_url=url))
    pilot = pilot_service.get_pilot(db, officer, str(pilot_id))
    pilot_service.verify_milestone(db, officer, pilot, by_seq[1], MilestoneVerify(
        verified_by=PILOT["validator"],
        remarks="Onboarding records and both language builds inspected on site.",
        status="verified",
        verification_report_url="/reports/krishinetra-m1-verification.pdf",
    ))
    _log(f"    {pilot.code}: Active; milestone 1 verified and paid, milestone 2 awaiting verification")


def seed_procured_pilot(db: Session, gov: dict[str, User], profiles: dict[str, StartupProfile],
                        problems: dict[str, Problem]) -> None:
    """A pilot taken all the way to Procured, plus a pending replication request for it."""
    spec = PROCURED_PILOT
    problem = problems[spec["problem"]]
    officer = db.get(User, problem.posted_by)
    solution = db.scalar(select(SolutionAbstract).where(
        SolutionAbstract.problem_id == problem.id, SolutionAbstract.startup_id == profiles[spec["startup"]].id
    ))
    _log(f"Creating a procured pilot for {problem.code} <- {STARTUPS_BY_KEY[spec['startup']].org_name}...")
    solution_service.save_rubric(db, gov["evaluator"], solution, RubricIn.model_validate(spec["rubric"]))
    try:
        pilot_id = str(pilot_service.create_pilot(db, officer, PilotCreate.model_validate({
            "solutionId": str(solution.id),
            "independentValidatorName": spec["validator"],
            "durationWeeks": solution.proposed_duration_weeks,
            "totalBudget": solution.proposed_cost,
            "milestones": spec["milestones"],
        })))
    except HTTPException as e:
        _log(f"    skipped: {e.detail}")
        return

    def fresh() -> Pilot:
        return pilot_service.get_pilot(db, officer, pilot_id)

    def verify(milestone_id, outcome: str, remarks: str) -> None:
        pilot_service.verify_milestone(db, officer, fresh(), milestone_id, MilestoneVerify(
            verified_by=spec["validator"], remarks=remarks, status=outcome,
        ))

    pilot_service.update_status(db, officer, fresh(), "Active")
    by_seq = {m.sequence: m.id for m in fresh().milestones}
    for seq, (kpi, url) in spec["deliverables"].items():
        pilot_service.submit_deliverable(db, fresh(), by_seq[seq], DeliverableSubmit(achieved_kpi=kpi, file_url=url))
    verify(by_seq[1], "verified", "Probe telemetry and enrolment register checked on site.")
    verify(by_seq[2], "failed", "One rotation was missed after a gateway outage; resubmit with the fix.")
    kpi, url = spec["m2_resubmission"]
    pilot_service.submit_deliverable(db, fresh(), by_seq[2], DeliverableSubmit(achieved_kpi=kpi, file_url=url))
    verify(by_seq[2], "verified", "Gateway redundancy confirmed; all rotations covered.")
    verify(by_seq[3], "verified", "Water meter readings and crop-cutting results match the report.")  # -> Completed
    pilot_service.update_status(db, officer, fresh(), "Recommended for procurement")
    pilot_service.update_status(db, officer, fresh(), "Procured")

    rep = spec["replication"]
    scale_service.create_replication(db, gov[rep["officer"]], ReplicationCreate.model_validate(
        {k: v for k, v in rep.items() if k != "officer"} | {"pilotId": pilot_id}
    ))
    _log(f"    {fresh().code}: Procured (proven solution); replication request from {rep['requestingOfficerName']} pending")


def clear(db: Session) -> dict[str, int]:
    """Delete every seeded user, their problems and everything hanging off them, then their
    uploaded files. Returns what was deleted."""
    user_ids = select(User.id).where(seeded_users_filter())
    profile_ids = select(StartupProfile.id).where(StartupProfile.user_id.in_(user_ids))
    problem_ids = select(Problem.id).where(Problem.posted_by.in_(user_ids))
    solutions = or_(SolutionAbstract.startup_id.in_(profile_ids), SolutionAbstract.problem_id.in_(problem_ids))

    # Collect file paths before the rows that point at them are gone.
    files = [p for p in db.scalars(select(StartupDocument.file_path).where(StartupDocument.startup_id.in_(profile_ids))) if p]
    files += [p for p in db.scalars(select(SolutionAbstract.file_path).where(solutions)) if p]
    pilot_ids = select(Pilot.id).where(or_(Pilot.problem_id.in_(problem_ids), Pilot.startup_id.in_(profile_ids)))
    procurement_ids = select(ProcurementRecord.id).where(ProcurementRecord.pilot_id.in_(pilot_ids))
    proven_ids = select(ProvenSolution.id).where(ProvenSolution.procurement_id.in_(procurement_ids))
    replications = or_(
        ReplicationRequest.proven_solution_id.in_(proven_ids),
        ReplicationRequest.pilot_id.in_(pilot_ids),
        ReplicationRequest.requesting_dept_id.in_(user_ids),
    )
    counts = {
        "users": len(db.scalars(user_ids).all()),
        "problems": len(db.scalars(problem_ids).all()),
        "pilots": len(db.scalars(pilot_ids).all()),
        "proven_solutions": len(db.scalars(proven_ids).all()),
        "replications": len(db.scalars(select(ReplicationRequest.id).where(replications)).all()),
        "solutions": len(db.scalars(select(SolutionAbstract.id).where(solutions)).all()),
        "files": len(files),
    }

    # Scale and procurement rows first, children before parents: replication requests point at
    # pilots and users, proven solutions at procurement records, procurement records at pilots,
    # and none of those foreign keys cascade.
    # Then pilots: pilots.problem_id / startup_id / solution_id have no ON DELETE CASCADE (a
    # pilot is a spending record; it shouldn't vanish because a problem was deleted), so they
    # would block the deletes below. Deleting a pilot cascades to its milestones, history and
    # audit entries.
    # Then problems: problems.posted_by has no ON DELETE CASCADE either, so deleting an officer
    # who still has problems would fail. Deleting a problem cascades (in Postgres, via ON DELETE
    # CASCADE) to its solutions, their eligibility checks and evaluations. Deleting a user
    # then cascades to the startup profile, its documents and its solutions.
    # synchronize_session=False: these are plain SQL DELETEs; we don't reuse any loaded objects.
    try:
        plain = {"synchronize_session": False}
        db.execute(delete(ReplicationRequest).where(replications).execution_options(**plain))
        db.execute(delete(ProvenSolution).where(ProvenSolution.id.in_(proven_ids)).execution_options(**plain))
        db.execute(delete(ProcurementRecord).where(ProcurementRecord.id.in_(procurement_ids)).execution_options(**plain))
        db.execute(delete(Pilot).where(Pilot.id.in_(pilot_ids)).execution_options(synchronize_session=False))
        db.execute(delete(Problem).where(Problem.id.in_(problem_ids)).execution_options(synchronize_session=False))
        db.execute(delete(User).where(User.id.in_(user_ids)).execution_options(synchronize_session=False))
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise SystemExit(
            "Couldn't clear the demo data: other rows (e.g. pilots, which have no ON DELETE CASCADE) still "
            f"reference it. Nothing was deleted.\n{e.orig}"
        )
    # Files only after the commit, so a failed delete never leaves rows pointing at missing files.
    for path in files:
        delete_upload(path)
    return counts


# ============================================================================================
# Report
# ============================================================================================

def print_credentials() -> None:
    rows = [(u["email"], u["role"], f"{u['name']} ({u['orgName']})") for u in GOV_USERS]
    rows += [(s.email, "startup", f"{s.name} ({s.org_name})") for s in STARTUPS]
    width = max(len(r[0]) for r in rows)
    _log(f"\nDemo logins (password for all: {PASSWORD})")
    for email, role, who in rows:
        _log(f"  {email:<{width}}  {role:<13} {who}")


def print_report(db: Session) -> None:
    problems = db.scalars(
        select(Problem).join(User, Problem.posted_by == User.id).where(seeded_users_filter()).order_by(Problem.code)
    ).all()
    pending_ml = False
    for problem in problems:
        _log(f"\n{problem.code}  [{problem.domain}, TRL-{problem.trl_expected}]  {problem.title}")
        rows = db.execute(
            select(SolutionAbstract, User.org_name, StartupProfile.domain, EligibilityCheck.rule_results)
            .join(StartupProfile, SolutionAbstract.startup_id == StartupProfile.id)
            .join(User, StartupProfile.user_id == User.id)
            .outerjoin(EligibilityCheck, EligibilityCheck.solution_id == SolutionAbstract.id)
            .where(SolutionAbstract.problem_id == problem.id)
            .order_by(SolutionAbstract.match_score.desc().nulls_last())
        ).all()
        for sol, startup_name, domain, rules in rows:
            score = f"{float(sol.match_score):.2f}" if sol.match_score is not None else "pending"
            statuses = [r["status"] for r in rules or []]
            if "fail" in statuses:
                verdict = "INELIGIBLE: " + "; ".join(r["reason"] for r in rules if r["status"] == "fail")
            elif "pending" in statuses or not rules:
                verdict = "pending (" + ", ".join(r["rule"] for r in rules or [] if r["status"] == "pending") + ")"
            else:
                verdict = "eligible"
            pending_ml |= sol.match_score is None or domain is None or sol.ai_summary is None
            _log(f"  match {score:>7}  {startup_name:<28} domain {domain or 'pending':<10}  {verdict}")
    for pilot in db.scalars(select(Pilot).where(Pilot.problem_id.in_([p.id for p in problems]))):
        done = sum(m.status == "verified" for m in pilot.milestones)
        _log(f"\nPilot {pilot.code}: {pilot.status}, {done}/{len(pilot.milestones)} milestones verified")
    for r in db.scalars(select(ReplicationRequest).where(
        ReplicationRequest.pilot_id.in_(select(Pilot.id).where(Pilot.problem_id.in_([p.id for p in problems])))
    )):
        _log(f"Replication request to {r.target_deployment_site}: {r.status}")
    if pending_ml:
        _log("\nSome ML results are pending. Start the ML service, then run: python retry_ml.py")


# ============================================================================================
# CLI
# ============================================================================================

def main() -> int:
    # Windows consoles may not be UTF-8; don't crash on a ₹ in a printed reason.
    sys.stdout.reconfigure(errors="replace")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--reset", action="store_true", help="remove the demo data, then seed it again")
    group.add_argument("--clear", action="store_true", help="only remove the demo data")
    parser.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    args = parser.parse_args()

    if args.reset or args.clear:
        url = make_url(get_settings().database_url)
        if (url.host or "localhost") not in LOCAL_HOSTS:
            print(f"Refusing to delete data on a non-local database (host={url.host}).", file=sys.stderr)
            return 1
        if not args.yes:
            answer = input(f"This deletes all @{EMAIL_DOMAIN} accounts and their data in {url.database!r}. "
                           "Type 'yes' to continue: ")
            if answer.strip().lower() != "yes":
                print("Aborted.")
                return 1

    with SessionLocal() as db:
        if args.reset or args.clear:
            counts = clear(db)
            _log("Cleared demo data: " + ", ".join(f"{n} {what}" for what, n in counts.items()))
            if args.clear:
                return 0
        elif is_seeded(db):
            _log(f"Demo data is already seeded (@{EMAIL_DOMAIN} accounts exist). Use --reset to rebuild it.")
            print_credentials()
            return 0

        if ml_reachable():
            _log("ML service is up: documents will be tagged and solutions ranked (this takes a minute or two).")
        else:
            _log("ML service is NOT reachable: seeding anyway, ML fields will stay pending.")
        seed(db)
        print_report(db)
    print_credentials()
    return 0


if __name__ == "__main__":
    sys.exit(main())
