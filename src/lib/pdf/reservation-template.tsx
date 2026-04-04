import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import { PdfInput } from "../services/pdf-dummy";

// ─── Helpers ────────────────────────────────────────────────────────────────

function nightsBetween(checkIn: string, checkOut: string): number {
  const d1 = new Date(checkIn);
  const d2 = new Date(checkOut);
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function referenceId(bookingId?: string): string {
  const base = bookingId || Date.now().toString(36);
  return `OPR-${base.slice(0, 8).toUpperCase()}`;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const colors = {
  primary: "#0369a1",    // sky-700
  accent: "#0ea5e9",     // sky-500
  dark: "#0f172a",       // slate-900
  muted: "#64748b",      // slate-500
  light: "#f1f5f9",      // slate-100
  border: "#e2e8f0",     // slate-200
  white: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: colors.dark,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  logo: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 2,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  refLabel: {
    fontSize: 8,
    color: colors.muted,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  refValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginTop: 2,
  },
  date: {
    fontSize: 8,
    color: colors.muted,
    marginTop: 4,
  },

  // Section
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // 2-col grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridItem: {
    width: "50%",
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 8,
    color: colors.muted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 1,
  },

  // Financial highlight
  financialBox: {
    backgroundColor: colors.light,
    borderRadius: 6,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  priceLabel: {
    fontSize: 10,
    color: colors.muted,
  },
  priceValue: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  priceBreakdown: {
    fontSize: 9,
    color: colors.muted,
    marginTop: 2,
  },

  // Special requests
  specialBox: {
    backgroundColor: colors.light,
    borderRadius: 4,
    padding: 10,
    marginTop: 4,
  },
  specialText: {
    fontSize: 10,
    color: colors.dark,
    lineHeight: 1.5,
  },

  // Footer
  footer: {
    position: "absolute" as const,
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: colors.muted,
  },
});

// ─── Component ──────────────────────────────────────────────────────────────

export function ReservationDocument({ input }: { input: PdfInput }) {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  const pricePerNight = nights > 0 ? Math.round(input.totalPrice / nights) : input.totalPrice;
  const ref = referenceId(input.bookingId);
  const generatedAt = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>OPERON</Text>
            <Text style={styles.subtitle}>Reservation Request</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.refLabel}>Reference</Text>
            <Text style={styles.refValue}>{ref}</Text>
            <Text style={styles.date}>{generatedAt}</Text>
          </View>
        </View>

        {/* Guest Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Guest Information</Text>
          <View style={styles.grid}>
            <Field label="Full Name" value={input.guestName} />
            <Field label="Passport Number" value={input.passport} />
            <Field label="Nationality" value={input.nationality} />
            <Field label="Email" value={input.email} />
            <Field label="Phone" value={input.phone} />
          </View>
        </View>

        {/* Hotel Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hotel & Room Details</Text>
          <View style={styles.grid}>
            <Field label="Hotel" value={input.hotelName} />
            <Field label="Room Type" value={input.roomType} />
            <Field label="Check-in" value={formatDate(input.checkIn)} />
            <Field label="Check-out" value={formatDate(input.checkOut)} />
            <Field label="Duration" value={`${nights} night${nights !== 1 ? "s" : ""}`} />
            <Field label="Guests" value={String(input.guestCount)} />
          </View>
        </View>

        {/* Financial */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing</Text>
          <View style={styles.financialBox}>
            <View>
              <Text style={styles.priceLabel}>Total Amount</Text>
              <Text style={styles.priceValue}>${input.totalPrice} USD</Text>
              <Text style={styles.priceBreakdown}>
                ${pricePerNight}/night x {nights} night{nights !== 1 ? "s" : ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" as const }}>
              <Text style={styles.priceLabel}>Sent To</Text>
              <Text style={{ ...styles.fieldValue, fontSize: 10 }}>{input.hotelEmail}</Text>
            </View>
          </View>
        </View>

        {/* Special Requests (if any) */}
        {input.specialRequests && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Requests</Text>
            <View style={styles.specialBox}>
              <Text style={styles.specialText}>{input.specialRequests}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generated by Operon Booking System — This document serves as a reservation request
          </Text>
          <Text style={styles.footerText}>{ref}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Sub-component ──────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.gridItem}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || "—"}</Text>
    </View>
  );
}
