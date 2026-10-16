-- ============================================================
-- FILE: 20261016000003_equipment_catalog_defaults.sql
-- PURPOSE: Initialize default survey equipment & subparts catalog
--          in system_settings (Drone with battery/charger, Total Station, DGPS, etc.)
-- ============================================================

INSERT INTO public.system_settings (key, value, updated_at)
VALUES (
  'equipment_catalog',
  '{
    "items": [
      {
        "id": "eq-esurvey",
        "name": "E-SURVEY",
        "category": "GNSS / Satellite",
        "code": "ESURV-01",
        "description": "E-Survey GNSS receiver kit with base, rovers, and accessories",
        "subparts": [
          { "id": "sub-esurv-tripod", "name": "TRIPOD", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-esurv-tribatch", "name": "TRIBATCH", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-esurv-conn-rod", "name": "CONNECTING ROD", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-esurv-base", "name": "E-SURVEY BASE", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-esurv-base-ant", "name": "E-SURVEY BASE ANTINA", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-esurv-controller", "name": "E-SURVEY CONTROLLER", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-esurv-chc-rover", "name": "CHC ROVER", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-esurv-chc-rover-ant", "name": "CHC ROVER ANTINA", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-esurv-chc-ctrl", "name": "CHC CONTROLLER", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-esurv-rover-rod", "name": "ROVER ROD", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-esurv-battery", "name": "BATTERY", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-esurv-bat-chg", "name": "BATTERY CHARGER", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-esurv-ctype-chg", "name": "C-TYPE MACHINE CHARGER", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-esurv-tape", "name": "MEASURING TAPE", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-esurv-bag", "name": "BAG", "defaultQuantity": 1, "isRequired": true }
        ]
      },
      {
        "id": "eq-chc",
        "name": "CHC",
        "category": "GNSS / Satellite",
        "code": "CHC-01",
        "description": "CHC GNSS receiver kit with base, rover, controller and accessories",
        "subparts": [
          { "id": "sub-chc-tripod", "name": "TRIPOD", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-chc-tribatch", "name": "TRIBATCH", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-chc-conn-rod", "name": "CONNECTING ROD", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-chc-base", "name": "CHC BASE", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-chc-base-ant", "name": "CHC BASE ANTINA", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-chc-ctrl", "name": "CHC CONTROLLER", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-chc-rover", "name": "CHC ROVER", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-chc-rover-ant", "name": "CHC ROVER ANTINA", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-chc-rover-rod", "name": "ROVER ROD", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-chc-battery", "name": "BATTERY", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-chc-bat-chg", "name": "BATTERY CHARGER", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-chc-ctype-chg", "name": "C-TYPE MACHINE CHARGER", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-chc-bag", "name": "BAG", "defaultQuantity": 1, "isRequired": true }
        ]
      },
      {
        "id": "eq-south",
        "name": "SOUTH",
        "category": "GNSS / Satellite",
        "code": "SOUTH-01",
        "description": "SOUTH GNSS receiver kit with antennas, rods, and accessories",
        "subparts": [
          { "id": "sub-south-tripod", "name": "TRIPOD", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-south-tribatch", "name": "TRIBATCH ( BROKEN UPPER BUBBLE TUBE )", "defaultQuantity": 1, "isRequired": true, "description": "Broken upper bubble tube" },
          { "id": "sub-south-conn-rod", "name": "CONNECTING ROD", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-south-base-ant", "name": "SOUTH BASE ANTINA", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-south-rover-ant", "name": "SOUTH ROVER ANTINA", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-south-rover-rod", "name": "ROVER ROD", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-south-battery", "name": "BATTERY", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-south-bat-chg", "name": "BATTERY CHARGER", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-south-bag", "name": "BAG ( DAMADGE BAG ZIP )", "defaultQuantity": 1, "isRequired": true, "description": "Damage bag zip" }
        ]
      },
      {
        "id": "eq-trimble",
        "name": "TRIMBLE",
        "category": "GNSS / Satellite",
        "code": "TRIMBLE-01",
        "description": "Trimble GNSS receiver kit with base, rover, battery and charger",
        "subparts": [
          { "id": "sub-trimble-tripod", "name": "TRIPOD", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-trimble-base", "name": "TRIMBLE BASE", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-trimble-rover", "name": "TRIMBLE ROVER", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-trimble-rover-rod", "name": "ROVER ROD", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-trimble-battery", "name": "BATTERY", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-trimble-bat-chg", "name": "BATTERY CHARGER", "defaultQuantity": 1, "isRequired": true }
        ]
      },
      {
        "id": "eq-robust",
        "name": "Robust",
        "category": "GNSS / Satellite",
        "code": "ROBUST-01",
        "description": "Robust GNSS receiver kit with base, rover, controls and accessories",
        "subparts": [
          { "id": "sub-robust-base", "name": "Base", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-robust-rover", "name": "Rover", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-robust-controles", "name": "Controles", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-robust-antenna", "name": "Antenna", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-robust-trbadge", "name": "Trbadge", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-robust-power-bank-road", "name": "Power bank road", "defaultQuantity": 1, "isRequired": true },
          { "id": "sub-robust-charger-c-type", "name": "Charger c type", "defaultQuantity": 1, "isRequired": true }
        ]
      }
    ]
  }'::jsonb,
  now()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;
