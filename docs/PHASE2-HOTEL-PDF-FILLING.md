# Phase 2: Hotel-Specific PDF Filling

## Overview

Some contracted hotels require their own proprietary reservation form to be filled rather than accepting Operon's standardized reservation document. Phase 2 adds the ability to fill hotel-provided PDF forms using coordinate-based field mapping.

## When to Implement

Implement this when you encounter hotels that reject the standard Operon PDF and require their own forms. Until then, Phase 1 (standardized PDF) covers all bookings.

## Architecture

- **Library**: `pdf-lib` — lightweight, zero-dependency PDF manipulation. Can load an existing PDF and draw text at exact coordinates on any page.
- **Storage**: Hotel PDF templates stored as blobs in the NoSQL database alongside the hotel document. Each room-type document already stores hotel/room details; add the template blob and coordinate config to the same document.
- **Config**: JSON coordinate maps stored per hotel template.

## Coordinate Config Format

```json
{
  "hotelId": "hotel-123",
  "templateVersion": "2024-01",
  "fields": [
    { "key": "guestName",    "page": 0, "x": 150, "y": 680, "fontSize": 12 },
    { "key": "passport",     "page": 0, "x": 150, "y": 650, "fontSize": 12 },
    { "key": "nationality",  "page": 0, "x": 150, "y": 620, "fontSize": 12 },
    { "key": "email",        "page": 0, "x": 150, "y": 590, "fontSize": 10 },
    { "key": "phone",        "page": 0, "x": 400, "y": 590, "fontSize": 10 },
    { "key": "checkIn",      "page": 0, "x": 150, "y": 520, "fontSize": 12 },
    { "key": "checkOut",     "page": 0, "x": 400, "y": 520, "fontSize": 12 },
    { "key": "roomType",     "page": 0, "x": 150, "y": 490, "fontSize": 12 },
    { "key": "guestCount",   "page": 0, "x": 400, "y": 490, "fontSize": 12 },
    { "key": "totalPrice",   "page": 0, "x": 150, "y": 460, "fontSize": 14 }
  ]
}
```

Keys map to the same `PdfInput` fields used in Phase 1.

## Developer Workflow for Onboarding a New Hotel Form

1. Obtain the hotel's blank PDF reservation form
2. Open in a PDF viewer that shows coordinates (e.g., Adobe Acrobat, or a simple web tool)
3. For each field that needs to be filled, note: page number, x coordinate, y coordinate, font size
4. Write the JSON coordinate config (see format above)
5. Upload both the PDF template blob and the config to the hotel's DB document
6. Test with sample booking data via dev endpoint: `POST /api/pdf/fill-test`

## Data Model Changes

```typescript
// Add to HotelRecord (or the NoSQL hotel document)
interface HotelPdfTemplate {
  templateBlobUrl: string;       // URL or DB reference to the blank PDF
  templateVersion: string;       // e.g., "2024-01" for change tracking
  coordinateConfig: CoordinateField[];
}

interface CoordinateField {
  key: string;       // maps to PdfInput field name
  page: number;      // 0-indexed page number
  x: number;         // x coordinate (points from left)
  y: number;         // y coordinate (points from bottom)
  fontSize: number;
  fontFamily?: string;  // default: Helvetica
}
```

## Implementation Steps

1. `npm install pdf-lib`
2. Create `src/lib/services/pdf-hotel-fill.ts` with `fillHotelPdf(hotelId: string, input: PdfInput): Promise<Uint8Array>`
3. Branch in workflow: if hotel has `customPdfTemplate`, use `fillHotelPdf()`; otherwise use the standard `@react-pdf/renderer` template
4. Update the `/api/pdf/[bookingId]` route to check for custom templates
5. Add admin endpoint for uploading hotel templates and configs
6. (Future) Build visual annotation UI if onboarding volume justifies it

## Choosing Between Phase 1 and Phase 2 at Runtime

```
if (hotel.customPdfTemplate) {
  // Phase 2: fill hotel's own PDF
  buffer = await fillHotelPdf(hotel.id, pdfInput);
} else {
  // Phase 1: generate standard Operon PDF
  buffer = await renderToBuffer(<ReservationDocument input={pdfInput} />);
}
```
