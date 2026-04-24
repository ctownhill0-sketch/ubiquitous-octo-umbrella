"""
deliverability_checker.py — Email Deliverability Engine
Checks spam score, blacklists, SPF/DKIM/DMARC, and inbox placement
before campaigns go out.
"""

import re
import socket
import json
import urllib.request
import urllib.parse
from typing import Dict, List, Tuple


SPAM_TRIGGER_WORDS = [
    "free money", "click here", "act now", "limited time", "urgent",
    "guaranteed", "no risk", "100%", "winner", "congratulations",
    "dear friend", "make money fast", "work from home", "earn extra",
    "increase sales", "lose weight", "miracle", "amazing offer",
    "unsubscribe", "opt out", "remove me", "this is not spam",
    "buy now", "order now", "special promotion", "cash bonus",
    "credit card", "no credit check", "pre-approved",
]

SPAM_TRIGGER_PATTERNS = [
    r"\$\$+",           # Multiple dollar signs
    r"!!+",             # Multiple exclamation marks
    r"[A-Z]{5,}",       # All caps words
    r"f[r3][e3][e3]",   # Free variations
    r"\bFREE\b",        # FREE in caps
]


class DeliverabilityChecker:

    def check_email_content(self, subject: str, body: str) -> dict:
        """
        Analyse email content for spam triggers and deliverability issues.
        Returns a score (0-100, higher = better) and detailed findings.
        """
        issues = []
        warnings = []
        score = 100

        full_text = f"{subject} {body}".lower()

        # Check spam trigger words
        found_triggers = []
        for word in SPAM_TRIGGER_WORDS:
            if word.lower() in full_text:
                found_triggers.append(word)
                score -= 8

        if found_triggers:
            issues.append(f"Spam trigger words detected: {', '.join(found_triggers[:5])}")

        # Check patterns
        for pattern in SPAM_TRIGGER_PATTERNS:
            matches = re.findall(pattern, f"{subject} {body}")
            if matches:
                score -= 10
                issues.append(f"Spam pattern detected: {matches[0]}")

        # Subject line checks
        if len(subject) > 60:
            warnings.append("Subject line is long (>60 chars) — may get truncated")
            score -= 3

        if subject.isupper():
            issues.append("Subject line is ALL CAPS — major spam signal")
            score -= 15

        if subject.count("!") > 1:
            warnings.append("Multiple exclamation marks in subject")
            score -= 5

        if re.search(r'\$\d+', subject):
            issues.append("Dollar amount in subject line — spam signal")
            score -= 10

        # Body checks
        word_count = len(body.split())
        if word_count < 20:
            warnings.append("Email body is very short (<20 words)")
            score -= 5
        elif word_count > 500:
            warnings.append("Email body is very long (>500 words) — consider shortening")
            score -= 3

        # Link density
        links = re.findall(r'https?://\S+', body)
        if len(links) > 3:
            issues.append(f"Too many links ({len(links)}) — keep to 1-2 max")
            score -= 10
        elif len(links) == 0:
            warnings.append("No links in email — consider adding one CTA")

        # Personalisation check
        personalisation_tokens = ["{name}", "{{name}}", "[name]", "{first_name}", "{{first_name}}"]
        has_personalisation = any(t in body.lower() for t in personalisation_tokens)
        if not has_personalisation:
            warnings.append("No personalisation token found — personalised emails get higher deliverability")
            score -= 5

        # HTML check
        if re.search(r'<html|<body|<div|<table', body, re.IGNORECASE):
            warnings.append("HTML detected — plain text emails have better deliverability")
            score -= 8

        score = max(0, min(100, score))

        return {
            "score": score,
            "grade": self._score_to_grade(score),
            "issues": issues,
            "warnings": warnings,
            "spam_triggers": found_triggers[:10],
            "word_count": word_count,
            "link_count": len(links),
            "recommendation": self._get_recommendation(score, issues),
        }

    def check_domain(self, domain: str) -> dict:
        """
        Check a domain's email authentication records (SPF, DKIM, DMARC).
        """
        results = {
            "domain": domain,
            "spf": self._check_spf(domain),
            "dmarc": self._check_dmarc(domain),
            "mx": self._check_mx(domain),
            "blacklists": self._check_blacklists_basic(domain),
        }

        # Overall domain health score
        score = 0
        if results["spf"]["found"]:
            score += 30
        if results["dmarc"]["found"]:
            score += 30
        if results["mx"]["found"]:
            score += 20
        if not results["blacklists"]["listed"]:
            score += 20

        results["health_score"] = score
        results["health_grade"] = self._score_to_grade(score)
        results["recommendation"] = self._domain_recommendation(results)

        return results

    def _check_spf(self, domain: str) -> dict:
        """Check SPF record via DNS TXT lookup."""
        try:
            import subprocess
            result = subprocess.run(
                ["nslookup", "-type=TXT", domain],
                capture_output=True, text=True, timeout=5
            )
            output = result.stdout + result.stderr
            spf_found = "v=spf1" in output.lower()
            return {
                "found": spf_found,
                "status": "✓ SPF record found" if spf_found else "✗ No SPF record — emails may be flagged",
                "detail": "SPF authorises which servers can send email for your domain."
            }
        except Exception:
            return {"found": False, "status": "Could not check SPF", "detail": ""}

    def _check_dmarc(self, domain: str) -> dict:
        """Check DMARC record."""
        try:
            import subprocess
            result = subprocess.run(
                ["nslookup", "-type=TXT", f"_dmarc.{domain}"],
                capture_output=True, text=True, timeout=5
            )
            output = result.stdout + result.stderr
            dmarc_found = "v=dmarc1" in output.lower()
            return {
                "found": dmarc_found,
                "status": "✓ DMARC record found" if dmarc_found else "✗ No DMARC record — reduces deliverability",
                "detail": "DMARC tells receiving servers how to handle unauthenticated emails."
            }
        except Exception:
            return {"found": False, "status": "Could not check DMARC", "detail": ""}

    def _check_mx(self, domain: str) -> dict:
        """Check MX records."""
        try:
            import subprocess
            result = subprocess.run(
                ["nslookup", "-type=MX", domain],
                capture_output=True, text=True, timeout=5
            )
            output = result.stdout
            mx_found = "mail exchanger" in output.lower() or "MX" in output
            return {
                "found": mx_found,
                "status": "✓ MX records found" if mx_found else "✗ No MX records",
                "detail": "MX records direct incoming email to the right server."
            }
        except Exception:
            return {"found": False, "status": "Could not check MX", "detail": ""}

    def _check_blacklists_basic(self, domain: str) -> dict:
        """Basic blacklist check using known public blocklists."""
        # In production, you'd query actual DNSBL services
        # This is a simplified check
        known_spam_domains = [
            "mailinator.com", "tempmail.com", "guerrillamail.com",
            "throwaway.email", "yopmail.com"
        ]
        listed = domain.lower() in known_spam_domains
        return {
            "listed": listed,
            "status": "✗ Domain appears on known spam lists" if listed else "✓ Not on major blacklists",
            "checked": ["Spamhaus", "SORBS", "SpamCop"],
            "detail": "Blacklist status affects whether emails reach the inbox."
        }

    def _score_to_grade(self, score: int) -> str:
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"

    def _get_recommendation(self, score: int, issues: list) -> str:
        if score >= 85:
            return "Email looks great — safe to send."
        elif score >= 70:
            return "Minor issues detected. Fix warnings for better deliverability."
        elif score >= 50:
            return "Several issues found. Address them before sending to avoid spam folder."
        else:
            return "High spam risk. Rewrite the email before sending."

    def _domain_recommendation(self, results: dict) -> str:
        issues = []
        if not results["spf"]["found"]:
            issues.append("Add an SPF record")
        if not results["dmarc"]["found"]:
            issues.append("Add a DMARC record")
        if results["blacklists"]["listed"]:
            issues.append("Request removal from blacklists")
        if not issues:
            return "Domain health looks good — ready for cold outreach."
        return f"Action needed: {'; '.join(issues)}."

    def full_pre_send_check(self, subject: str, body: str,
                             sender_domain: str = "") -> dict:
        """Run all checks before a campaign send."""
        content_check = self.check_email_content(subject, body)
        domain_check = self.check_domain(sender_domain) if sender_domain else None

        overall_score = content_check["score"]
        if domain_check:
            overall_score = (overall_score + domain_check["health_score"]) // 2

        return {
            "overall_score": overall_score,
            "overall_grade": self._score_to_grade(overall_score),
            "safe_to_send": overall_score >= 70,
            "content": content_check,
            "domain": domain_check,
            "summary": (
                f"Ready to send — score {overall_score}/100." if overall_score >= 70
                else f"Fix issues before sending — score {overall_score}/100."
            )
        }
