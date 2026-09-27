"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Rocket } from "lucide-react";
import { authApi } from "@/lib/api";
import { ApiError, errorMessage } from "@/lib/http";
import { UserRole } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("startup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [dpiitNumber, setDpiitNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg("");
    // Admins can't self-register; the tabs only offer these three.
    if (role === "admin") return;

    const cleanDpiit = dpiitNumber.trim().toUpperCase();
    if (role === "startup") {
      const DPIIT_REGEX = /^(DIPP|DPIIT)\d{5}$/i;
      if (!cleanDpiit || !DPIIT_REGEX.test(cleanDpiit)) {
        setErrorMsg("Please enter a valid DPIIT recognition number (e.g. DIPP84920 or DPIIT12345).");
        return;
      }
    }

    if (role !== "startup" && !department.trim()) {
      setErrorMsg("Please enter your division / laboratory / department.");
      return;
    }
    if (new TextEncoder().encode(password).length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.signup({
        role,
        name: name.trim(),
        email: email.trim(),
        orgName: orgName.trim(),
        password,
        ...(role === "startup" ? { dpiitNumber: cleanDpiit } : { department: department.trim() }),
      });
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError && err.status === 409
          ? "An account with this email already exists. Sign in instead."
          : errorMessage(err, "Registration failed. Please retry.")
      );
      setSubmitting(false);
      return;
    }

    if (role === "startup") {
      router.push("/startup/profile");
    } else {
      router.push("/gov/problems");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--ink)] font-editorial">
          Create SAMARTH Account
        </h2>
        <p className="text-xs text-[var(--ink-muted)] mt-1">
          Register your organization or government division
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-[6px] text-xs text-[var(--danger)]">
          {errorMsg}
        </div>
      )}

      {/* Role Selection Tabs */}
      <div className="grid grid-cols-3 p-1 bg-[var(--surface)] border border-[var(--line)] rounded-[6px] text-center">
        <button
          type="button"
          onClick={() => setRole("startup")}
          className={`py-1.5 text-xs font-medium rounded-[4px] transition-colors flex items-center justify-center gap-1 cursor-pointer ${
            role === "startup"
              ? "bg-[var(--accent)] text-white font-semibold shadow-xs"
              : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
          }`}
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>Startup</span>
        </button>

        <button
          type="button"
          onClick={() => setRole("govt_officer")}
          className={`py-1.5 text-xs font-medium rounded-[4px] transition-colors flex items-center justify-center gap-1 cursor-pointer ${
            role === "govt_officer"
              ? "bg-[var(--accent)] text-white font-semibold shadow-xs"
              : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Govt Officer</span>
        </button>

        <button
          type="button"
          onClick={() => setRole("evaluator")}
          className={`py-1.5 text-xs font-medium rounded-[4px] transition-colors flex items-center justify-center gap-1 cursor-pointer ${
            role === "evaluator"
              ? "bg-[var(--accent)] text-white font-semibold shadow-xs"
              : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
          }`}
        >
          <span>Evaluator</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name of Authorized Representative"
          placeholder="e.g. S. Narayanan"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Input
          label="Official Email Address"
          type="email"
          placeholder={role === "startup" ? "founder@startup.com" : "officer@gov.in"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          label={role === "startup" ? "Startup Legal Entity Name" : "Ministry / Institute / Department Name"}
          placeholder={role === "startup" ? "e.g. Drishti Vision Systems Pvt Ltd" : "e.g. Dept. of Heavy Industry / IIT Delhi"}
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          required
        />

        {role === "startup" ? (
          <Input
            label="DPIIT Recognition Number"
            placeholder="e.g. DIPP84920"
            value={dpiitNumber}
            onChange={(e) => setDpiitNumber(e.target.value)}
            helperText="Provides automatic GFR 194 prior turnover exemptions"
            required
          />
        ) : (
          <Input
            label="Division / Laboratory / Department"
            placeholder="e.g. Innovation & Technology Acquisition Cell"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
          />
        )}

        <Input
          label="Create Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          helperText="At least 8 characters"
          required
        />

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? "Registering..." : "Complete Registration"}
        </Button>
      </form>

      <div className="text-center text-xs text-[var(--ink-muted)]">
        Already registered?{" "}
        <Link href="/login" className="text-[var(--accent)] font-medium hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
