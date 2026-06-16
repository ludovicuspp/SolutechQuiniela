from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.graphics.shapes import Drawing, Rect, String, Circle, Line
from reportlab.graphics import renderPDF
from reportlab.platypus.flowables import Flowable
import math

# ── COLORS ──────────────────────────────────────────────────────────────────
C_NAVY     = colors.HexColor("#0A1628")
C_BLUE     = colors.HexColor("#1A3A6E")
C_ACCENT   = colors.HexColor("#00B4D8")
C_GOLD     = colors.HexColor("#F5A623")
C_GREEN    = colors.HexColor("#27AE60")
C_RED      = colors.HexColor("#E74C3C")
C_LIGHT    = colors.HexColor("#F0F4F8")
C_GRAY     = colors.HexColor("#6B7280")
C_DARK     = colors.HexColor("#1F2937")
C_WHITE    = colors.white
C_BORDER   = colors.HexColor("#CBD5E1")

W, H = A4

# ── STYLES ───────────────────────────────────────────────────────────────────
def make_styles():
    base = getSampleStyleSheet()
    s = {}

    s['body'] = ParagraphStyle('body',
        fontName='Helvetica', fontSize=10, leading=15,
        textColor=C_DARK, spaceAfter=6, alignment=TA_JUSTIFY)

    s['body_small'] = ParagraphStyle('body_small',
        fontName='Helvetica', fontSize=9, leading=13,
        textColor=C_DARK, spaceAfter=4)

    s['h1'] = ParagraphStyle('h1',
        fontName='Helvetica-Bold', fontSize=20, leading=26,
        textColor=C_WHITE, spaceAfter=4, spaceBefore=4)

    s['h2'] = ParagraphStyle('h2',
        fontName='Helvetica-Bold', fontSize=14, leading=18,
        textColor=C_WHITE, spaceAfter=2)

    s['h3'] = ParagraphStyle('h3',
        fontName='Helvetica-Bold', fontSize=11, leading=15,
        textColor=C_BLUE, spaceAfter=4, spaceBefore=8)

    s['step_num'] = ParagraphStyle('step_num',
        fontName='Helvetica-Bold', fontSize=13, leading=16,
        textColor=C_WHITE, alignment=TA_CENTER)

    s['step_title'] = ParagraphStyle('step_title',
        fontName='Helvetica-Bold', fontSize=10, leading=14,
        textColor=C_BLUE)

    s['step_body'] = ParagraphStyle('step_body',
        fontName='Helvetica', fontSize=9, leading=13,
        textColor=C_DARK)

    s['tip'] = ParagraphStyle('tip',
        fontName='Helvetica-Oblique', fontSize=9, leading=13,
        textColor=C_BLUE, leftIndent=8)

    s['warning'] = ParagraphStyle('warning',
        fontName='Helvetica', fontSize=9, leading=13,
        textColor=colors.HexColor("#7C3626"))

    s['toc_title'] = ParagraphStyle('toc_title',
        fontName='Helvetica-Bold', fontSize=10, leading=14,
        textColor=C_DARK)

    s['toc_page'] = ParagraphStyle('toc_page',
        fontName='Helvetica', fontSize=10, leading=14,
        textColor=C_GRAY, alignment=TA_CENTER)

    s['cover_sub'] = ParagraphStyle('cover_sub',
        fontName='Helvetica', fontSize=13, leading=18,
        textColor=colors.HexColor("#90CAF9"), alignment=TA_CENTER)

    s['cover_tagline'] = ParagraphStyle('cover_tagline',
        fontName='Helvetica-Oblique', fontSize=11, leading=16,
        textColor=colors.HexColor("#B0C4DE"), alignment=TA_CENTER)

    s['label'] = ParagraphStyle('label',
        fontName='Helvetica-Bold', fontSize=9, leading=12,
        textColor=C_WHITE, alignment=TA_CENTER)

    s['cell'] = ParagraphStyle('cell',
        fontName='Helvetica', fontSize=9, leading=12, textColor=C_DARK)

    s['cell_bold'] = ParagraphStyle('cell_bold',
        fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=C_DARK)

    s['footer'] = ParagraphStyle('footer',
        fontName='Helvetica', fontSize=8, leading=10,
        textColor=C_GRAY, alignment=TA_CENTER)

    return s

# ── CUSTOM FLOWABLES ─────────────────────────────────────────────────────────
class SectionHeader(Flowable):
    """Colored section header bar with section number and title."""
    def __init__(self, number, title, color=None, width=None):
        super().__init__()
        self.number = number
        self.title = title
        self.color = color or C_BLUE
        self.w = width or (W - 40*mm)
        self.h = 28

    def wrap(self, aw, ah):
        return self.w, self.h + 8

    def draw(self):
        c = self.canv
        # Main bar
        c.setFillColor(self.color)
        c.roundRect(0, 4, self.w, self.h, 6, fill=1, stroke=0)
        # Number badge
        c.setFillColor(C_ACCENT)
        c.circle(18, 4 + self.h/2, 11, fill=1, stroke=0)
        c.setFillColor(C_WHITE)
        c.setFont("Helvetica-Bold", 11)
        c.drawCentredString(18, 4 + self.h/2 - 4, str(self.number))
        # Title
        c.setFillColor(C_WHITE)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(36, 4 + self.h/2 - 5, self.title)

class TipBox(Flowable):
    """A highlighted tip/note box."""
    def __init__(self, text, kind="tip", width=None):
        super().__init__()
        self.text = text
        self.kind = kind  # "tip", "warning", "info"
        self.w = width or (W - 40*mm)

    def wrap(self, aw, ah):
        lines = len(self.text) // 65 + 1
        self.h = max(36, lines * 14 + 16)
        return self.w, self.h + 4

    def draw(self):
        c = self.canv
        if self.kind == "warning":
            bg = colors.HexColor("#FFF3CD")
            border = C_GOLD
            icon = "⚠"
            tc = colors.HexColor("#664D03")
        elif self.kind == "info":
            bg = colors.HexColor("#D1ECF1")
            border = C_ACCENT
            icon = "ℹ"
            tc = colors.HexColor("#0C5460")
        else:
            bg = colors.HexColor("#D4EDDA")
            border = C_GREEN
            icon = "✓"
            tc = colors.HexColor("#155724")

        c.setFillColor(bg)
        c.roundRect(0, 2, self.w, self.h, 5, fill=1, stroke=0)
        c.setStrokeColor(border)
        c.setLineWidth(1.5)
        c.roundRect(0, 2, self.w, self.h, 5, fill=0, stroke=1)
        # Left accent
        c.setFillColor(border)
        c.rect(0, 2, 4, self.h, fill=1, stroke=0)
        # Icon
        c.setFillColor(tc)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(12, 2 + self.h/2 - 4, icon)
        # Text
        c.setFont("Helvetica", 9)
        c.setFillColor(tc)
        # Simple text wrapping
        words = self.text.split()
        line = ""
        y = 2 + self.h - 14
        for word in words:
            test = (line + " " + word).strip()
            if c.stringWidth(test, "Helvetica", 9) < self.w - 34:
                line = test
            else:
                c.drawString(28, y, line)
                y -= 13
                line = word
        if line:
            c.drawString(28, y, line)

class StepCard(Flowable):
    """A numbered step card with title and description."""
    def __init__(self, num, title, desc, width=None):
        super().__init__()
        self.num = num
        self.title = title
        self.desc = desc
        self.w = width or (W - 40*mm)
        # Estimate height
        chars = len(desc)
        lines = max(2, chars // 70 + 1)
        self.h = 20 + lines * 13

    def wrap(self, aw, ah):
        return self.w, self.h + 8

    def draw(self):
        c = self.canv
        # Card background
        c.setFillColor(C_LIGHT)
        c.roundRect(0, 4, self.w, self.h, 5, fill=1, stroke=0)
        c.setStrokeColor(C_BORDER)
        c.setLineWidth(0.5)
        c.roundRect(0, 4, self.w, self.h, 5, fill=0, stroke=1)
        # Number circle
        c.setFillColor(C_BLUE)
        c.circle(18, 4 + self.h - 15, 10, fill=1, stroke=0)
        c.setFillColor(C_WHITE)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(18, 4 + self.h - 19, str(self.num))
        # Title
        c.setFillColor(C_BLUE)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(34, 4 + self.h - 18, self.title)
        # Description
        c.setFillColor(C_DARK)
        c.setFont("Helvetica", 9)
        words = self.desc.split()
        line = ""
        y = 4 + self.h - 32
        for word in words:
            test = (line + " " + word).strip()
            if c.stringWidth(test, "Helvetica", 9) < self.w - 44:
                line = test
            else:
                c.drawString(34, y, line)
                y -= 13
                line = word
        if line:
            c.drawString(34, y, line)

class NavCard(Flowable):
    """Navigation icon card."""
    def __init__(self, icon, name, desc, color, width=None):
        super().__init__()
        self.icon = icon
        self.name = name
        self.desc = desc
        self.color = color
        self.w = width or 75
        self.h = 70

    def wrap(self, aw, ah):
        return self.w, self.h + 4

    def draw(self):
        c = self.canv
        # Shadow
        c.setFillColor(colors.HexColor("#E2E8F0"))
        c.roundRect(2, 0, self.w-2, self.h, 8, fill=1, stroke=0)
        # Card
        c.setFillColor(C_WHITE)
        c.roundRect(0, 2, self.w-2, self.h, 8, fill=1, stroke=0)
        c.setStrokeColor(self.color)
        c.setLineWidth(1.5)
        c.roundRect(0, 2, self.w-2, self.h, 8, fill=0, stroke=1)
        # Icon circle
        cx = (self.w-2)/2
        c.setFillColor(self.color)
        c.circle(cx, 2 + self.h - 22, 14, fill=1, stroke=0)
        c.setFillColor(C_WHITE)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(cx, 2 + self.h - 27, self.icon)
        # Name
        c.setFillColor(C_DARK)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(cx, 2 + self.h - 43, self.name)
        # Desc
        c.setFillColor(C_GRAY)
        c.setFont("Helvetica", 7)
        words = self.desc.split()
        line = ""
        y = 2 + self.h - 54
        for word in words:
            test = (line + " " + word).strip()
            if c.stringWidth(test, "Helvetica", 7) < self.w - 10:
                line = test
            else:
                c.drawCentredString(cx, y, line)
                y -= 9
                line = word
        if line:
            c.drawCentredString(cx, y, line)

class BetCard(Flowable):
    """Bet type card with multiplier badge."""
    def __init__(self, icon, btype, mult, desc, color, width=None):
        super().__init__()
        self.icon = icon
        self.btype = btype
        self.mult = mult
        self.desc = desc
        self.color = color
        self.w = width or (W - 40*mm)
        self.h = 50

    def wrap(self, aw, ah):
        return self.w, self.h + 6

    def draw(self):
        c = self.canv
        c.setFillColor(C_LIGHT)
        c.roundRect(0, 4, self.w, self.h, 6, fill=1, stroke=0)
        c.setStrokeColor(self.color)
        c.setLineWidth(1.5)
        c.roundRect(0, 4, self.w, self.h, 6, fill=0, stroke=1)
        # Left color bar
        c.setFillColor(self.color)
        c.roundRect(0, 4, 6, self.h, 3, fill=1, stroke=0)
        # Icon
        c.setFillColor(self.color)
        c.circle(22, 4 + self.h/2, 14, fill=1, stroke=0)
        c.setFillColor(C_WHITE)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(22, 4 + self.h/2 - 5, self.icon)
        # Type
        c.setFillColor(C_DARK)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(44, 4 + self.h - 16, self.btype)
        # Desc
        c.setFillColor(C_GRAY)
        c.setFont("Helvetica", 9)
        c.drawString(44, 4 + self.h - 30, self.desc)
        # Multiplier badge
        badge_w = 48
        bx = self.w - badge_w - 10
        c.setFillColor(self.color)
        c.roundRect(bx, 4 + self.h/2 - 12, badge_w, 24, 5, fill=1, stroke=0)
        c.setFillColor(C_WHITE)
        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(bx + badge_w/2, 4 + self.h/2 - 6, self.mult)

class CoverPage(Flowable):
    """Full cover page drawn as a flowable."""
    def __init__(self):
        super().__init__()
        self.w = W - 20*mm
        self.h = H - 30*mm

    def wrap(self, aw, ah):
        return self.w, self.h

    def draw(self):
        c = self.canv
        w, h = self.w, self.h

        # Deep gradient background (simulated with rectangles)
        steps = 30
        for i in range(steps):
            t = i / steps
            r = int(10 + t * 16)
            g = int(22 + t * 35)
            b = int(40 + t * 70)
            c.setFillColorRGB(r/255, g/255, b/255)
            band_h = h / steps + 1
            c.rect(0, h - (i+1)*band_h, w, band_h + 1, fill=1, stroke=0)

        # Decorative circles
        c.setFillColor(colors.HexColor("#0D2B5A"))
        c.circle(w * 0.85, h * 0.75, 90, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#0B2244"))
        c.circle(w * 0.1, h * 0.2, 60, fill=1, stroke=0)

        # Accent lines
        c.setStrokeColor(C_ACCENT)
        c.setLineWidth(2)
        c.line(30, h - 80, w - 30, h - 80)
        c.setLineWidth(0.5)
        c.line(30, 80, w - 30, 80)

        # Soccer ball emoji (drawn)
        cx, cy, r = w/2, h * 0.52, 55
        c.setFillColor(C_WHITE)
        c.circle(cx, cy, r, fill=1, stroke=0)
        c.setFillColor(C_DARK)
        # Pentagon-ish patches
        patches = [(0, r*0.55), (r*0.52, r*0.17), (r*0.32, -r*0.45),
                   (-r*0.32, -r*0.45), (-r*0.52, r*0.17)]
        for px, py in patches:
            c.setFillColor(C_DARK)
            c.circle(cx+px, cy+py, r*0.18, fill=1, stroke=0)
        c.setStrokeColor(colors.HexColor("#999999"))
        c.setLineWidth(0.5)
        c.circle(cx, cy, r, fill=0, stroke=1)

        # Gold glow ring
        c.setStrokeColor(C_GOLD)
        c.setLineWidth(2)
        c.circle(cx, cy, r + 8, fill=0, stroke=1)
        c.setStrokeColor(colors.HexColor("#F5A62340"))
        c.setLineWidth(6)
        c.circle(cx, cy, r + 14, fill=0, stroke=1)

        # App name
        c.setFillColor(C_GOLD)
        c.setFont("Helvetica-Bold", 42)
        c.drawCentredString(w/2, h * 0.83, "IronMundial")
        c.setFillColor(C_ACCENT)
        c.setFont("Helvetica-Bold", 26)
        c.drawCentredString(w/2, h * 0.78, "2026")

        # Subtitle
        c.setFillColor(colors.HexColor("#90CAF9"))
        c.setFont("Helvetica", 13)
        c.drawCentredString(w/2, h * 0.73, "Guía de Usuario")

        # Tagline
        c.setFillColor(colors.HexColor("#B0C4DE"))
        c.setFont("Helvetica-Oblique", 10)
        c.drawCentredString(w/2, h * 0.32, "Plataforma de apuestas deportivas para clientes")
        c.drawCentredString(w/2, h * 0.30, "de Inversiones Terraplena")

        # Bottom bar
        c.setFillColor(C_ACCENT)
        c.rect(0, 0, w, 6, fill=1, stroke=0)

        # Version tag
        c.setFillColor(colors.HexColor("#00000060"))
        c.roundRect(w/2 - 45, 14, 90, 20, 4, fill=1, stroke=0)
        c.setFillColor(C_WHITE)
        c.setFont("Helvetica", 8)
        c.drawCentredString(w/2, 21, "Versión 1.0  •  Mundial 2026")

# ── HELPERS ──────────────────────────────────────────────────────────────────
def divider(color=C_BORDER, thickness=0.5):
    return HRFlowable(width="100%", thickness=thickness,
                      color=color, spaceAfter=4, spaceBefore=4)

def sp(n=6):
    return Spacer(1, n)

def make_table(data, col_widths, header_color=C_BLUE, stripe=True):
    """Styled table with header and optional stripes."""
    n_cols = len(data[0])
    style = [
        ('BACKGROUND', (0,0), (-1,0), header_color),
        ('TEXTCOLOR', (0,0), (-1,0), C_WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('ALIGN', (0,0), (-1,0), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 9),
        ('ROWBACKGROUNDS', (0,1), (-1,-1),
         [C_WHITE, C_LIGHT] if stripe else [C_WHITE]),
        ('GRID', (0,0), (-1,-1), 0.5, C_BORDER),
        ('ROUNDEDCORNERS', [4,4,4,4]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle(style))
    return t

# ── PAGE TEMPLATE ─────────────────────────────────────────────────────────────
def draw_cover(canvas):
    w, h = A4
    canvas.saveState()

    # Deep gradient background (simulated with rectangles)
    steps = 30
    for i in range(steps):
        t = i / steps
        r = int(10 + t * 16)
        g = int(22 + t * 35)
        b = int(40 + t * 70)
        canvas.setFillColorRGB(r/255, g/255, b/255)
        band_h = h / steps + 1
        canvas.rect(0, h - (i+1)*band_h, w, band_h + 1, fill=1, stroke=0)

    # Decorative circles
    canvas.setFillColor(colors.HexColor("#0D2B5A"))
    canvas.circle(w * 0.85, h * 0.75, 90, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#0B2244"))
    canvas.circle(w * 0.1, h * 0.2, 60, fill=1, stroke=0)

    # Accent lines
    canvas.setStrokeColor(C_ACCENT)
    canvas.setLineWidth(2)
    canvas.line(30, h - 80, w - 30, h - 80)
    canvas.setLineWidth(0.5)
    canvas.line(30, 80, w - 30, 80)

    # Soccer ball
    cx, cy, r = w/2, h * 0.52, 55
    canvas.setFillColor(C_WHITE)
    canvas.circle(cx, cy, r, fill=1, stroke=0)
    canvas.setFillColor(C_DARK)
    patches = [(0, r*0.55), (r*0.52, r*0.17), (r*0.32, -r*0.45),
               (-r*0.32, -r*0.45), (-r*0.52, r*0.17)]
    for px, py in patches:
        canvas.setFillColor(C_DARK)
        canvas.circle(cx+px, cy+py, r*0.18, fill=1, stroke=0)
    canvas.setStrokeColor(colors.HexColor("#999999"))
    canvas.setLineWidth(0.5)
    canvas.circle(cx, cy, r, fill=0, stroke=1)

    # Gold glow ring
    canvas.setStrokeColor(C_GOLD)
    canvas.setLineWidth(2)
    canvas.circle(cx, cy, r + 8, fill=0, stroke=1)
    canvas.setStrokeColor(colors.HexColor("#F5A62340"))
    canvas.setLineWidth(6)
    canvas.circle(cx, cy, r + 14, fill=0, stroke=1)

    # App name
    canvas.setFillColor(C_GOLD)
    canvas.setFont("Helvetica-Bold", 42)
    canvas.drawCentredString(w/2, h * 0.83, "IronMundial")
    canvas.setFillColor(C_ACCENT)
    canvas.setFont("Helvetica-Bold", 26)
    canvas.drawCentredString(w/2, h * 0.78, "2026")

    # Subtitle
    canvas.setFillColor(colors.HexColor("#90CAF9"))
    canvas.setFont("Helvetica", 13)
    canvas.drawCentredString(w/2, h * 0.73, "Guía de Usuario")

    # Tagline
    canvas.setFillColor(colors.HexColor("#B0C4DE"))
    canvas.setFont("Helvetica-Oblique", 10)
    canvas.drawCentredString(w/2, h * 0.32, "Plataforma de apuestas deportivas para clientes")
    canvas.drawCentredString(w/2, h * 0.30, "de Inversiones Terraplena")

    # Bottom bar
    canvas.setFillColor(C_ACCENT)
    canvas.rect(0, 0, w, 6, fill=1, stroke=0)

    # Version tag
    canvas.setFillColor(colors.HexColor("#00000060"))
    canvas.roundRect(w/2 - 45, 14, 90, 20, 4, fill=1, stroke=0)
    canvas.setFillColor(C_WHITE)
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(w/2, 21, "Versión 1.0  •  Mundial 2026")

    canvas.restoreState()

def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    pg = canvas.getPageNumber()

    if pg == 1:
        # Cover page - full-bleed drawing
        draw_cover(canvas)
        canvas.restoreState()
        return

    # Header stripe
    canvas.setFillColor(C_NAVY)
    canvas.rect(0, h - 18*mm, w, 18*mm, fill=1, stroke=0)
    canvas.setFillColor(C_GOLD)
    canvas.rect(0, h - 18*mm - 2, w, 2, fill=1, stroke=0)
    canvas.setFillColor(C_WHITE)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(20*mm, h - 12*mm, "IronMundial 2026")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#90CAF9"))
    canvas.drawRightString(w - 20*mm, h - 12*mm, "Guía de Usuario")

    # Footer
    canvas.setFillColor(C_LIGHT)
    canvas.rect(0, 0, w, 12*mm, fill=1, stroke=0)
    canvas.setFillColor(C_ACCENT)
    canvas.rect(0, 12*mm, w, 1, fill=1, stroke=0)
    canvas.setFillColor(C_GRAY)
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(w/2, 5*mm, f"— {pg} —")
    canvas.drawString(20*mm, 5*mm, "© 2026 Inversiones Terraplena")
    canvas.drawRightString(w - 20*mm, 5*mm, "ironmundial.com")

    canvas.restoreState()

# ── BUILD PDF ────────────────────────────────────────────────────────────────
def build_pdf(path):
    S = make_styles()
    margin = 20*mm

    doc = SimpleDocTemplate(
        path,
        pagesize=A4,
        leftMargin=margin, rightMargin=margin,
        topMargin=22*mm, bottomMargin=16*mm,
        title="IronMundial 2026 — Guía de Usuario",
        author="Inversiones Terraplena",
        subject="Manual de usuario de la app IronMundial"
    )

    content_w = W - 2*margin
    story = []

    # ── COVER ────────────────────────────────────────────────────────────────
    # Cover rendered by on_page (draw_cover) — just push a blank spacer + page break
    story.append(Spacer(1, 10))
    story.append(PageBreak())

    # ── TABLE OF CONTENTS ─────────────────────────────────────────────────────
    story.append(sp(10))
    story.append(Paragraph("Contenido", ParagraphStyle('toc_h',
        fontName='Helvetica-Bold', fontSize=20, textColor=C_NAVY, spaceAfter=6)))
    story.append(divider(C_ACCENT, 2))
    story.append(sp(8))

    toc_items = [
        ("1", "Registro", "3"),
        ("2", "Inicio de Sesión", "4"),
        ("3", "Navegación Principal", "5"),
        ("4", "Cómo Apostar", "6"),
        ("5", "Puntos y Billetera", "7"),
        ("6", "Ranking y Premios", "8"),
        ("7", "Partidos en Vivo", "9"),
        ("8", "Notificaciones", "9"),
        ("9", "Perfil", "10"),
        ("10", "Panel de Administración", "10"),
        ("11", "Soporte", "12"),
    ]

    toc_data = []
    for num, title, page in toc_items:
        toc_data.append([
            Paragraph(f"<font color='#1A3A6E'><b>{num}</b></font>", S['toc_title']),
            Paragraph(title, S['toc_title']),
            Paragraph(page, S['toc_page']),
        ])

    toc_table = Table(toc_data, colWidths=[12*mm, content_w - 25*mm, 13*mm])
    toc_style = [
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [C_WHITE, C_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING', (0,0), (0,-1), 8),
        ('LINEBELOW', (0,0), (-1,-1), 0.3, C_BORDER),
    ]
    toc_table.setStyle(TableStyle(toc_style))
    story.append(toc_table)
    story.append(PageBreak())

    # ── SECTION 1: REGISTRO ──────────────────────────────────────────────────
    story.append(SectionHeader(1, "Registro", C_BLUE, content_w))
    story.append(sp(10))
    story.append(Paragraph(
        "Para usar IronMundial 2026 debes ser cliente activo de <b>Inversiones Terraplena</b>. "
        "El proceso de registro consta de tres pasos simples:",
        S['body']))
    story.append(sp(8))

    steps_reg = [
        ("1", "Verificar RIF",
         "Ingresa tu RIF (ej: J-12345678-9). El sistema busca tus datos en el ERP, verifica que seas "
         "cliente activo y calcula automáticamente tus puntos iniciales basados en tus facturas recientes."),
        ("2", "Completar Formulario",
         "Completa: teléfono venezolano (pre-cargado desde el ERP, editable), alias público para el ranking, "
         "email opcional y contraseña de mínimo 6 caracteres."),
        ("3", "Verificar Teléfono",
         "Recibirás un SMS con un PIN de 6 dígitos. Ingresa el código para activar tu cuenta. "
         "Puedes reenviar el código tras 60 segundos o solicitar verificación manual si el SMS no llega."),
    ]
    for num, title, desc in steps_reg:
        story.append(StepCard(num, title, desc, content_w))
        story.append(sp(6))

    story.append(sp(4))
    story.append(TipBox(
        "Si el SMS nunca llega, presiona 'Solicitar verificación manual'. "
        "Un administrador revisará y activará tu cuenta sin necesidad del SMS.",
        kind="info", width=content_w))
    story.append(sp(4))
    story.append(TipBox(
        "Si no eres cliente activo de Inversiones Terraplena, no podrás completar el registro. "
        "Contacta a tu ejecutivo de cuenta para más información.",
        kind="warning", width=content_w))
    story.append(PageBreak())

    # ── SECTION 2: INICIO DE SESIÓN ──────────────────────────────────────────
    story.append(SectionHeader(2, "Inicio de Sesión", C_BLUE, content_w))
    story.append(sp(10))

    login_steps = [
        ("1", "Ingresa tu número de teléfono", "Usa formato venezolano: 0412-XXXXXXX"),
        ("2", "Ingresa tu contraseña", "La misma que registraste durante el alta"),
        ("3", "Accede a la app", "Si los datos son correctos, verás la pantalla de inicio"),
    ]
    for num, title, desc in login_steps:
        story.append(StepCard(num, title, desc, content_w))
        story.append(sp(5))

    story.append(sp(8))
    story.append(Paragraph("Recuperación de contraseña", S['h3']))
    story.append(TipBox(
        "La recuperación de contraseña no está disponible aún de forma automática. "
        "Si olvidaste tu contraseña, contacta directamente al administrador del sistema.",
        kind="warning", width=content_w))
    story.append(PageBreak())

    # ── SECTION 3: NAVEGACIÓN PRINCIPAL ─────────────────────────────────────
    story.append(SectionHeader(3, "Navegación Principal", C_BLUE, content_w))
    story.append(sp(10))
    story.append(Paragraph(
        "La app tiene <b>6 secciones</b> accesibles desde el menú inferior de la pantalla:",
        S['body']))
    story.append(sp(12))

    nav_items = [
        ("🏠", "Inicio",    "Resumen rápido",    C_BLUE),
        ("⚽", "Partidos",  "Todos los partidos", C_GREEN),
        ("🎯", "Jugadas",   "Tu historial",       C_GOLD),
        ("💰", "Puntos",    "Saldo y facturas",   C_ACCENT),
        ("🏆", "Ranking",   "Tabla y premios",    colors.HexColor("#9B59B6")),
        ("👤", "Perfil",    "Tus datos",          C_RED),
    ]

    card_w = (content_w - 5*5) / 6  # 6 cards with 5 gaps
    nav_cards = [[NavCard(ic, nm, ds, co, card_w) for ic, nm, ds, co in nav_items]]
    nav_table = Table(nav_cards, colWidths=[card_w + 1] * 6)
    nav_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 2),
        ('RIGHTPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(nav_table)
    story.append(sp(14))

    # Descriptions table
    nav_desc = [
        [Paragraph("<b>Sección</b>", S['cell_bold']),
         Paragraph("<b>Descripción detallada</b>", S['cell_bold'])],
        [Paragraph("🏠 Inicio", S['cell_bold']),
         Paragraph("Resumen de tus puntos, apuestas recientes y próximos partidos del mundial.", S['cell'])],
        [Paragraph("⚽ Partidos", S['cell_bold']),
         Paragraph("Todos los partidos del mundial con filtros por fase (Grupos, Octavos, Cuartos, Semi, Final).", S['cell'])],
        [Paragraph("🎯 Mis Jugadas", S['cell_bold']),
         Paragraph("Historial completo de tus apuestas con estadísticas de aciertos y ganancias.", S['cell'])],
        [Paragraph("💰 Mis Puntos", S['cell_bold']),
         Paragraph("Saldo actual, historial de transacciones y sincronización con tus facturas del ERP.", S['cell'])],
        [Paragraph("🏆 Ranking", S['cell_bold']),
         Paragraph("Tabla con los 100 mejores jugadores, premios por corte y ganadores actuales.", S['cell'])],
        [Paragraph("👤 Perfil", S['cell_bold']),
         Paragraph("Editar datos personales, cambiar alias, activar modo oscuro y cerrar sesión.", S['cell'])],
    ]
    story.append(make_table(nav_desc, [45*mm, content_w - 45*mm]))
    story.append(PageBreak())

    # ── SECTION 4: APUESTAS ──────────────────────────────────────────────────
    story.append(SectionHeader(4, "Cómo Apostar", C_BLUE, content_w))
    story.append(sp(10))
    story.append(Paragraph(
        "Pronostica el resultado de los partidos y multiplica tus puntos. "
        "Hay tres tipos de apuesta disponibles:",
        S['body']))
    story.append(sp(10))

    bet_types = [
        ("🏆", "Ganador",  "×2", "Elige qué equipo ganará el partido",     C_GREEN),
        ("🤝", "Empate",   "×3", "Pronostica que el partido termina igualado", C_GOLD),
        ("🎯", "Exacto",   "×5", "Acierta el marcador exacto del partido",  C_RED),
    ]
    for icon, btype, mult, desc, color in bet_types:
        story.append(BetCard(icon, btype, mult, desc, color, content_w))
        story.append(sp(6))

    story.append(sp(8))
    story.append(Paragraph("Pasos para apostar", S['h3']))
    story.append(sp(4))

    bet_steps = [
        ("1", "Ve a Partidos",       "Selecciona la fase del mundial que te interesa."),
        ("2", "Elige un partido",    "Busca un partido con estado 'Programado' y presiona Pronosticar."),
        ("3", "Selecciona el tipo",  "Elige entre Ganador, Empate o Exacto según tu predicción."),
        ("4", "Define el monto",     "Ingresa cuántos puntos apostas. Usa los botones rápidos: 25%, 50%, 75% o 100% de tu saldo."),
        ("5", "Confirma la apuesta", "Revisa la ganancia potencial que se muestra y confirma."),
    ]
    for num, title, desc in bet_steps:
        story.append(StepCard(num, title, desc, content_w))
        story.append(sp(5))

    story.append(sp(6))
    story.append(Paragraph("Reglas importantes", S['h3']))

    rules = [
        ["✓", "Solo puedes apostar una vez por partido."],
        ["✓", "Las apuestas se cierran automáticamente cuando el partido comienza."],
        ["✓", "No se pueden modificar ni cancelar apuestas ya enviadas."],
        ["✓", "Las apuestas ganadas acreditan los puntos automáticamente a tu billetera."],
        ["✓", "Los marcadores se actualizan desde la API oficial de football-data.org."],
    ]
    rules_data = [[Paragraph(r[0], ParagraphStyle('ico', fontName='Helvetica-Bold',
                    fontSize=10, textColor=C_GREEN)),
                   Paragraph(r[1], S['body_small'])] for r in rules]
    rt = Table(rules_data, colWidths=[8*mm, content_w - 8*mm])
    rt.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(rt)
    story.append(PageBreak())

    # ── SECTION 5: PUNTOS ────────────────────────────────────────────────────
    story.append(SectionHeader(5, "Puntos y Billetera", C_BLUE, content_w))
    story.append(sp(10))
    story.append(Paragraph(
        "Los puntos son la moneda de la app. Puedes obtenerlos de tres formas:",
        S['body']))
    story.append(sp(8))

    pts_data = [
        [Paragraph("<b>Fuente</b>", S['cell_bold']),
         Paragraph("<b>Descripción</b>", S['cell_bold']),
         Paragraph("<b>Tipo</b>", S['cell_bold'])],
        [Paragraph("🧾 Facturas ERP", S['cell_bold']),
         Paragraph("Tus compras en Inversiones Terraplena se convierten en puntos a razón de 1 USD = 1 punto. "
                   "Se procesan facturas desde el 1 de junio de 2026.", S['cell']),
         Paragraph("✚ Entrada", ParagraphStyle('green', fontName='Helvetica-Bold',
                    fontSize=9, textColor=C_GREEN))],
        [Paragraph("🎯 Apuestas ganadas", S['cell_bold']),
         Paragraph("Cuando aciertas una apuesta, ganas tu monto multiplicado por el factor del tipo elegido.", S['cell']),
         Paragraph("✚ Entrada", ParagraphStyle('green2', fontName='Helvetica-Bold',
                    fontSize=9, textColor=C_GREEN))],
        [Paragraph("👑 Admin", S['cell_bold']),
         Paragraph("El administrador puede asignarte puntos adicionales de forma manual.", S['cell']),
         Paragraph("✚ Entrada", ParagraphStyle('green3', fontName='Helvetica-Bold',
                    fontSize=9, textColor=C_GREEN))],
    ]
    story.append(make_table(pts_data, [40*mm, content_w - 65*mm, 25*mm]))
    story.append(sp(12))

    story.append(Paragraph("Sincronización con el ERP", S['h3']))
    story.append(Paragraph(
        "La billetera se sincroniza automáticamente con el sistema ERP cada vez que ingresas "
        "a <b>Mis Puntos</b>. También puedes presionar el botón <b>\"Sincronizar\"</b> para forzar "
        "una actualización manual en cualquier momento.",
        S['body']))
    story.append(sp(8))

    story.append(Paragraph("Tipos de transacciones", S['h3']))
    tx_data = [
        [Paragraph("<b>Tipo</b>", S['cell_bold']),
         Paragraph("<b>Descripción</b>", S['cell_bold']),
         Paragraph("<b>Signo</b>", S['cell_bold'])],
        [Paragraph("Compras", S['cell_bold']),
         Paragraph("Puntos acreditados por facturas del ERP", S['cell']),
         Paragraph("( + )", ParagraphStyle('p', fontName='Helvetica-Bold', fontSize=9, textColor=C_GREEN))],
        [Paragraph("Apuestas", S['cell_bold']),
         Paragraph("Puntos descontados al realizar una apuesta", S['cell']),
         Paragraph("( − )", ParagraphStyle('m', fontName='Helvetica-Bold', fontSize=9, textColor=C_RED))],
        [Paragraph("Ganancias", S['cell_bold']),
         Paragraph("Puntos ganados por apuestas acertadas", S['cell']),
         Paragraph("( + )", ParagraphStyle('p2', fontName='Helvetica-Bold', fontSize=9, textColor=C_GREEN))],
        [Paragraph("Reembolsos", S['cell_bold']),
         Paragraph("Puntos devueltos por el administrador", S['cell']),
         Paragraph("( + )", ParagraphStyle('p3', fontName='Helvetica-Bold', fontSize=9, textColor=C_GREEN))],
    ]
    story.append(make_table(tx_data, [40*mm, content_w - 65*mm, 25*mm]))
    story.append(PageBreak())

    # ── SECTION 6: RANKING ───────────────────────────────────────────────────
    story.append(SectionHeader(6, "Ranking y Premios", C_BLUE, content_w))
    story.append(sp(10))
    story.append(Paragraph(
        "El ranking clasifica a los jugadores por <b>puntos totales ganados en apuestas</b>. "
        "Se muestran los mejores 100 jugadores y tu posición se destaca en azul.",
        S['body']))
    story.append(sp(10))

    story.append(Paragraph("Cortes del torneo", S['h3']))
    story.append(Paragraph(
        "Hay 4 cortes a lo largo del Mundial. En cada corte, los 3 primeros del ranking "
        "reciben premios asignados por el administrador:",
        S['body']))
    story.append(sp(6))

    cortes = [
        ["🏅", "Corte 1", "Ronda de 32", "Top 3 ganan premios"],
        ["🥈", "Corte 2", "Octavos de final", "Top 3 ganan premios"],
        ["🥇", "Corte 3", "Cuartos de final", "Top 3 ganan premios"],
        ["🏆", "Corte 4", "Final del Mundial", "Top 3 ganan premios"],
    ]

    corte_data = [
        [Paragraph("<b>Corte</b>", S['cell_bold']),
         Paragraph("<b>Nombre</b>", S['cell_bold']),
         Paragraph("<b>Fase</b>", S['cell_bold']),
         Paragraph("<b>Premio</b>", S['cell_bold'])]
    ] + [
        [Paragraph(c[0], S['cell']),
         Paragraph(c[1], S['cell_bold']),
         Paragraph(c[2], S['cell']),
         Paragraph(c[3], S['cell'])] for c in cortes
    ]
    story.append(make_table(corte_data,
        [12*mm, 30*mm, content_w - 80*mm, 38*mm], header_color=colors.HexColor("#9B59B6")))
    story.append(PageBreak())

    # ── SECTION 7: PARTIDOS EN VIVO ──────────────────────────────────────────
    story.append(SectionHeader(7, "Partidos en Vivo", C_BLUE, content_w))
    story.append(sp(10))

    live_items = [
        ("🔴", "Actualización automática", "Los marcadores se actualizan cada 30 segundos durante los partidos en curso."),
        ("🟢", "Indicador visual", "Los partidos en vivo muestran un punto verde parpadeante para identificarlos fácilmente."),
        ("📊", "Tiempo real", "Puedes ver el marcador actualizado en tiempo real sin necesidad de recargar la pantalla."),
    ]
    for icon, title, desc in live_items:
        story.append(StepCard(icon, title, desc, content_w))
        story.append(sp(5))

    story.append(sp(8))

    # ── SECTION 8: NOTIFICACIONES ─────────────────────────────────────────────
    story.append(SectionHeader(8, "Notificaciones", C_BLUE, content_w))
    story.append(sp(10))
    story.append(Paragraph(
        "El icono 🔔 en la barra superior indica notificaciones no leídas. "
        "Recibirás alertas en los siguientes casos:",
        S['body']))
    story.append(sp(6))

    notif_data = [
        [Paragraph("<b>Evento</b>", S['cell_bold']),
         Paragraph("<b>Descripción</b>", S['cell_bold'])],
        [Paragraph("🎯 Resultado de apuesta", S['cell_bold']),
         Paragraph("Notificación cuando una apuesta tuya resulta ganadora o perdedora.", S['cell'])],
        [Paragraph("📢 Aviso del admin", S['cell_bold']),
         Paragraph("El administrador puede enviar notificaciones globales a todos los usuarios.", S['cell'])],
    ]
    story.append(make_table(notif_data, [50*mm, content_w - 50*mm]))
    story.append(sp(8))
    story.append(TipBox(
        "Presiona una notificación para marcarla como leída. "
        "Usa 'Marcar todas' para limpiar todas de una vez.",
        kind="tip", width=content_w))
    story.append(sp(10))

    # ── SECTION 9: PERFIL ─────────────────────────────────────────────────────
    story.append(SectionHeader(9, "Perfil", C_BLUE, content_w))
    story.append(sp(10))
    story.append(Paragraph("Desde la sección Perfil puedes:", S['body']))
    story.append(sp(4))

    perfil_items = [
        "Ver y editar tus datos personales",
        "Cambiar tu alias público (el nombre que aparece en el ranking)",
        "Activar o desactivar el modo oscuro",
        "Cerrar sesión de la app",
    ]
    for item in perfil_items:
        story.append(StepCard("→", item, "", content_w))
        story.append(sp(4))
    story.append(PageBreak())

    # ── SECTION 10: PANEL DE ADMINISTRACIÓN ──────────────────────────────────
    story.append(SectionHeader(10, "Panel de Administración",
                               colors.HexColor("#7B2D8B"), content_w))
    story.append(sp(6))
    story.append(TipBox(
        "Esta sección es solo accesible para usuarios con permisos de administrador. "
        "Accede desde /admin en la URL o presionando el ícono de escudo 🛡️ en la barra superior.",
        kind="warning", width=content_w))
    story.append(sp(8))
    story.append(Paragraph("Funciones disponibles", S['h3']))

    admin_data = [
        [Paragraph("<b>Pestaña</b>", S['cell_bold']),
         Paragraph("<b>Función</b>", S['cell_bold'])],
        [Paragraph("🏅 Premios", S['cell_bold']),
         Paragraph("CRUD de premios por corte y posición.", S['cell'])],
        [Paragraph("👥 Usuarios", S['cell_bold']),
         Paragraph("Crear, editar y eliminar usuarios. Los creados por admin no requieren verificar teléfono.", S['cell'])],
        [Paragraph("✅ Verificación", S['cell_bold']),
         Paragraph("Aprobar o rechazar solicitudes de verificación manual de usuarios que no recibieron SMS.", S['cell'])],
        [Paragraph("🧾 Facturación", S['cell_bold']),
         Paragraph("Registrar facturas/notas para acreditar puntos manualmente. Ver documentos procesados.", S['cell'])],
        [Paragraph("🔔 Notificaciones", S['cell_bold']),
         Paragraph("Enviar notificaciones globales a todos los usuarios registrados.", S['cell'])],
        [Paragraph("🔄 Sincronizar", S['cell_bold']),
         Paragraph("Sincronizar todos los partidos del mundial desde la API de football-data.org.", S['cell'])],
        [Paragraph("⚽ Resolver", S['cell_bold']),
         Paragraph("Ver partidos finalizados sin verificar y resolver sus apuestas de forma manual.", S['cell'])],
    ]
    story.append(make_table(admin_data, [42*mm, content_w - 42*mm],
                            header_color=colors.HexColor("#7B2D8B")))
    story.append(sp(12))

    story.append(Paragraph("Flujo de verificación manual", S['h3']))
    story.append(sp(4))

    flujo_steps = [
        ("1", "Usuario se registra", "El usuario completa el formulario pero no recibe el SMS de verificación."),
        ("2", "Solicitud manual", "El usuario presiona 'Solicitar verificación manual' en la pantalla de verificación."),
        ("3", "Revisión en Admin", "Aparece una solicitud en la pestaña Verificación del Panel de Administración."),
        ("4", "Decisión del admin", "El admin revisa los datos y presiona Aprobar (crea el usuario automáticamente) o Rechazar."),
    ]
    for num, title, desc in flujo_steps:
        story.append(StepCard(num, title, desc, content_w))
        story.append(sp(5))

    story.append(PageBreak())

    # ── SECTION 11: SOPORTE ──────────────────────────────────────────────────
    story.append(SectionHeader(11, "Soporte", C_BLUE, content_w))
    story.append(sp(10))
    story.append(Paragraph(
        "¿Tienes dudas o algún problema con la app? Estamos para ayudarte:",
        S['body']))
    story.append(sp(8))

    soporte_data = [
        [Paragraph("<b>Canal</b>", S['cell_bold']),
         Paragraph("<b>Descripción</b>", S['cell_bold'])],
        [Paragraph("💬 WhatsApp", S['cell_bold']),
         Paragraph("Botón flotante en la esquina inferior derecha. Contacta soporte directamente desde la app.", S['cell'])],
        [Paragraph("👨‍💼 Administrador", S['cell_bold']),
         Paragraph("Para problemas técnicos, reseteo de contraseña o verificación manual de cuentas.", S['cell'])],
    ]
    story.append(make_table(soporte_data, [40*mm, content_w - 40*mm]))
    story.append(sp(12))
    story.append(TipBox(
        "Para recuperación de contraseña, contacta directamente al administrador del sistema. "
        "Esta función aún no está disponible de forma automática en la app.",
        kind="info", width=content_w))

    # ── BUILD ────────────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"PDF generado: {path}")


output_path = r"C:\Users\LuisV\Documents\Actividades Laborales\ironmundial2026\IronMundial_2026_Guia_Usuario.pdf"
build_pdf(output_path)
