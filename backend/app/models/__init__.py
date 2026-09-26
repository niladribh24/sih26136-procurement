"""Importing this package registers every model on Base.metadata."""

from app.models.agreement import IpAgreement, KpiLog, Validation
from app.models.base import Base
from app.models.evaluation import EligibilityCheck, Evaluation
from app.models.pilot import Pilot, PilotMilestone
from app.models.problem import Problem, SolutionAbstract
from app.models.procurement import ProcurementRecord, ProvenSolution, ReplicationRequest
from app.models.startup import StartupDocument, StartupProfile
from app.models.user import User

__all__ = [
    "Base",
    "EligibilityCheck",
    "Evaluation",
    "IpAgreement",
    "KpiLog",
    "Pilot",
    "PilotMilestone",
    "ProcurementRecord",
    "Problem",
    "ProvenSolution",
    "ReplicationRequest",
    "SolutionAbstract",
    "StartupDocument",
    "StartupProfile",
    "User",
    "Validation",
]
