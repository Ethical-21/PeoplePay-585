"""
PeoplePay585 — PDF Payslip Generator
Uses fpdf2 to create professional payslip PDFs.
"""

import io
from decimal import Decimal
from datetime import date
from fpdf import FPDF


class PayslipPDF(FPDF):
    """Custom PDF class for payslip generation."""

    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=25)

    def header(self):
        self.set_font("Helvetica", "B", 18)
        self.set_text_color(30, 58, 138)  # Primary blue
        self.cell(0, 10, "PeoplePay585", 0, 0, "L")
        self.set_font("Helvetica", "", 9)
        self.set_text_color(100, 116, 139)
        self.cell(0, 10, "HR & Payroll Management", 0, 1, "R")
        self.set_draw_color(30, 58, 138)
        self.set_line_width(0.5)
        self.line(10, 22, 200, 22)
        self.ln(8)

    def footer(self):
        self.set_y(-20)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 10, "This is a computer-generated payslip and does not require a signature.", 0, 0, "C")
        self.ln(4)
        self.cell(0, 10, f"PeoplePay585 - Odoo Hackathon 2026 | Page {self.page_no()}", 0, 0, "C")

    def section_title(self, title: str):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(30, 58, 138)
        self.set_fill_color(241, 245, 249)
        self.cell(0, 8, f"  {title}", 0, 1, "L", fill=True)
        self.ln(2)

    def info_row(self, label: str, value: str, bold_value: bool = False):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(100, 116, 139)
        self.cell(45, 6, label, 0, 0, "L")
        self.set_text_color(15, 23, 42)
        self.set_font("Helvetica", "B" if bold_value else "", 9)
        self.cell(50, 6, value, 0, 0, "L")

    def salary_table_header(self):
        self.set_font("Helvetica", "B", 9)
        self.set_fill_color(30, 58, 138)
        self.set_text_color(255, 255, 255)
        self.cell(80, 7, "  Component", 1, 0, "L", fill=True)
        self.cell(35, 7, "Category", 1, 0, "C", fill=True)
        self.cell(35, 7, "Type", 1, 0, "C", fill=True)
        self.cell(40, 7, "Amount", 1, 1, "R", fill=True)

    def salary_table_row(self, name: str, category: str, calc_type: str, amount: str, is_deduction: bool = False):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(15, 23, 42)
        self.set_fill_color(248, 250, 252)
        fill = self.page_no() % 2 == 0  # Alternate row shading
        self.cell(80, 6, f"  {name}", "LR", 0, "L")
        self.set_text_color(100, 116, 139)
        self.cell(35, 6, category.title(), "LR", 0, "C")
        self.cell(35, 6, calc_type.title(), "LR", 0, "C")
        if is_deduction:
            self.set_text_color(220, 38, 38)
            self.cell(40, 6, f"- {amount}", "LR", 1, "R")
        else:
            self.set_text_color(21, 128, 61)
            self.cell(40, 6, amount, "LR", 1, "R")

    def salary_total_row(self, label: str, amount: str, is_net: bool = False):
        self.set_font("Helvetica", "B", 10)
        if is_net:
            self.set_fill_color(30, 58, 138)
            self.set_text_color(255, 255, 255)
        else:
            self.set_fill_color(241, 245, 249)
            self.set_text_color(15, 23, 42)
        self.cell(150, 8, f"  {label}", 1, 0, "L", fill=True)
        self.cell(40, 8, amount, 1, 1, "R", fill=True)


def format_currency(amount) -> str:
    """Format a number as Indian currency."""
    try:
        val = float(amount)
        return f"INR {val:,.2f}"
    except (ValueError, TypeError):
        return "INR 0.00"


def generate_payslip_pdf(
    employee_name: str,
    employee_number: str,
    employee_email: str,
    department: str,
    job_title: str,
    contract_name: str,
    wage: float,
    period_start: date,
    period_end: date,
    salary_structure_name: str,
    lines: list[dict],
    gross_salary: float,
    total_deductions: float,
    net_salary: float,
    payrun_name: str = "",
    payslip_id: int = 0,
) -> bytes:
    """Generate a professional payslip PDF and return bytes."""
    pdf = PayslipPDF()
    pdf.add_page()

    # ── Title ──
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 10, "SALARY SLIP", 0, 1, "C")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 5, f"Pay Period: {period_start.strftime('%d %b %Y')} - {period_end.strftime('%d %b %Y')}", 0, 1, "C")
    pdf.ln(6)

    # ── Employee Info ──
    pdf.section_title("Employee Information")
    pdf.info_row("Employee Name:", employee_name, bold_value=True)
    pdf.info_row("Employee ID:", employee_number)
    pdf.ln(6)
    pdf.info_row("Email:", employee_email)
    pdf.info_row("Department:", department)
    pdf.ln(6)
    pdf.info_row("Job Title:", job_title or "N/A")
    pdf.info_row("Contract:", contract_name)
    pdf.ln(6)
    pdf.info_row("Salary Structure:", salary_structure_name)
    pdf.info_row("Base Wage:", format_currency(wage))
    pdf.ln(8)

    # ── Salary Breakdown ──
    pdf.section_title("Salary Breakdown")
    pdf.salary_table_header()

    for line in lines:
        is_ded = line.get("category", "").lower() == "deduction"
        pdf.salary_table_row(
            name=line.get("name", ""),
            category=line.get("category", ""),
            calc_type=line.get("calculation_type", "fixed"),
            amount=format_currency(line.get("amount", 0)),
            is_deduction=is_ded,
        )

    pdf.ln(4)

    # ── Totals ──
    pdf.section_title("Summary")
    pdf.salary_total_row("Gross Salary", format_currency(gross_salary))
    pdf.salary_total_row("Total Deductions", format_currency(total_deductions))
    pdf.salary_total_row("NET SALARY", format_currency(net_salary), is_net=True)

    pdf.ln(8)

    # ── Meta ──
    if payrun_name:
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(148, 163, 184)
        pdf.cell(0, 5, f"Payrun: {payrun_name} | Payslip #{payslip_id}", 0, 1, "C")

    return pdf.output()
