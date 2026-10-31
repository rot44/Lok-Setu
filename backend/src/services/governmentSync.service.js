import { Document } from "../models/document.model.js";
import { generateStructuredJson } from "./gemini.service.js";
import { indexingService } from "./indexing.service.js";
import { DOCUMENT_TYPES, JURISDICTION_LEVELS } from "../constants.js";
import { parsePibRssXml, extractPibReleaseContent } from "./pibWatcher.service.js";
import crypto from "crypto";

/**
 * Official Regional Press Information Bureau (PIB) RSS Feed Endpoints.
 * Maps Indian states and administrative zones to their official government RSS release feeds.
 */
export const PIB_REGIONAL_BUREAUS = [
    { state: "ALL", code: 48, name: "PIB New Delhi (Central All-India)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=48&lang=1" },
    { state: "Maharashtra", code: 3, name: "PIB Mumbai (Maharashtra & Goa)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=3&lang=1" },
    { state: "Uttar Pradesh", code: 30, name: "PIB Lucknow (Uttar Pradesh)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=30&lang=1" },
    { state: "Karnataka", code: 14, name: "PIB Bengaluru (Karnataka)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=14&lang=1" },
    { state: "Tamil Nadu", code: 22, name: "PIB Chennai (Tamil Nadu & Puducherry)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=22&lang=1" },
    { state: "West Bengal", code: 10, name: "PIB Kolkata (West Bengal & A&N)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=10&lang=1" },
    { state: "Telangana", code: 11, name: "PIB Hyderabad (Telangana & Andhra Pradesh)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=11&lang=1" },
    { state: "Gujarat", code: 2, name: "PIB Ahmedabad (Gujarat)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=2&lang=1" },
    { state: "Bihar", code: 26, name: "PIB Patna (Bihar)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=26&lang=1" },
    { state: "Kerala", code: 24, name: "PIB Thiruvananthapuram (Kerala & Lakshadweep)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=24&lang=1" },
    { state: "Rajasthan", code: 15, name: "PIB Jaipur (Rajasthan)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=15&lang=1" },
    { state: "Punjab", code: 6, name: "PIB Chandigarh (Punjab, Haryana, HP, Chandigarh)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=6&lang=1" },
    { state: "Assam", code: 8, name: "PIB Guwahati (Assam & North East Region)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=8&lang=1" },
    { state: "Madhya Pradesh", code: 16, name: "PIB Bhopal (Madhya Pradesh)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=16&lang=1" },
    { state: "Odisha", code: 17, name: "PIB Bhubaneswar (Odisha)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=17&lang=1" },
    { state: "Uttarakhand", code: 7, name: "PIB Dehradun (Uttarakhand)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=7&lang=1" },
    { state: "Jharkhand", code: 27, name: "PIB Ranchi (Jharkhand)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=27&lang=1" },
    { state: "Chhattisgarh", code: 29, name: "PIB Raipur (Chhattisgarh)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=29&lang=1" },
    { state: "Jammu and Kashmir", code: 4, name: "PIB Jammu (J&K and Ladakh)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=4&lang=1" },
    { state: "Goa", code: 1, name: "PIB Panaji (Goa)", url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=1&lang=1" },
];

/**
 * Standard Gemini response schema for government scheme normalization.
 */
export const GOV_SCHEME_NORMALIZATION_SCHEMA = {
    type: "OBJECT",
    properties: {
        isCivicPolicyOrWelfare: {
            type: "BOOLEAN",
            description: "True if the announcement introduces or updates a welfare policy, subsidy, government scheme, or civic regulation.",
        },
        title: {
            type: "STRING",
            description: "Clean, standardized scheme or notification title.",
        },
        documentType: {
            type: "STRING",
            enum: [
                "welfare_policy",
                "government_notification",
                "circular",
                "municipal_law",
                "subsidies_grants",
            ],
            description: "Statutory categorization.",
        },
        jurisdictionLevel: {
            type: "STRING",
            enum: ["central", "state", "municipal"],
            description: "Jurisdiction scope.",
        },
        applicableState: {
            type: "STRING",
            description: "Indian state name, or 'ALL' if it applies nationwide across India.",
        },
        issuingAuthority: {
            type: "STRING",
            description: "Official Ministry or State Department name.",
        },
        summary: {
            type: "STRING",
            description: "Concise 2-sentence citizen summary of key entitlements and scope.",
        },
        tags: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Civic sector tags (e.g. ['Agriculture', 'Direct Benefit Transfer', 'Central Govt']).",
        },
        eligibilityRules: {
            type: "OBJECT",
            properties: {
                minAge: { type: "NUMBER", description: "Minimum age required or 0 if none." },
                maxAge: { type: "NUMBER", description: "Maximum age allowed or 120 if none." },
                genders: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                    description: "Targeted genders: ['female'], ['male'], ['transgender'], or ['ALL'].",
                },
                castes: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                    description: "Targeted social categories: ['sc'], ['st'], ['obc'], ['general'], or ['ALL'].",
                },
                religions: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                    description: "Targeted religious communities or ['ALL'].",
                },
                occupations: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                    description: "Targeted professions: ['farmer'], ['student'], ['artisan_craftsperson'], ['street_vendor'], ['shopkeeper_msme'], ['unemployed'], ['ALL'].",
                },
                maxAnnualIncome: {
                    type: "STRING",
                    description: "Annual family income ceiling or 'any' if unconstrained.",
                },
                requiresRationCard: {
                    type: "BOOLEAN",
                    description: "True if BPL / Antyodaya ration card is explicitly required.",
                },
                requiresDisabilityStatus: {
                    type: "BOOLEAN",
                    description: "True if valid Divyangjan / disability certificate is required.",
                },
            },
            required: ["minAge", "maxAge", "genders", "castes", "occupations"],
        },
        applicationDeadline: {
            type: "STRING",
            description: "Explicit application deadline ISO date string, or null if ongoing.",
        },
        officialPortalUrl: {
            type: "STRING",
            description: "Official online portal or departmental website URL.",
        },
    },
    required: [
        "isCivicPolicyOrWelfare",
        "title",
        "documentType",
        "jurisdictionLevel",
        "applicableState",
        "issuingAuthority",
        "summary",
        "tags",
        "eligibilityRules",
    ],
};

/**
 * National Comprehensive Baseline Scheme Catalog across all 28 States & key UTs,
 * spanning all demographic categories (Women, Youth, Farmers, MSME, Divyangjan, Senior Citizens).
 */
export const NATIONAL_BASELINE_SCHEMES = [
    // ─── DIVYANGJAN (SPECIALLY ABLED) WELFARE ──────────────────────────────
    {
        title: "Sugamya Bharat Abhiyan (Accessible India Campaign & Assistive Aids)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Social Justice and Empowerment (Department of Empowerment of Persons with Disabilities)",
        eligibilityRules: {
            minAge: 0,
            maxAge: 120,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: true,
        },
        rawExtractedText: `Sugamya Bharat Abhiyan is a nationwide flagship campaign for achieving universal accessibility for Persons with Disabilities (Divyangjan).
Key Benefits:
1. Physical and digital infrastructure accessibility retrofitting in public transport, railway stations, airports, and portals.
2. Free assistive devices, motorized tricycles, braille kits, hearing aids, and prosthetics through ALIMCO under the ADIP scheme.
3. Concessional self-employment loans up to ₹50 Lakh via National Handicapped Finance and Development Corporation (NHFDC).`,
        officialPortalUrl: "https://disabilityaffairs.gov.in",
        tags: ["Specially Abled", "Divyangjan", "Accessibility", "Assistive Devices", "Central Govt"],
        isActive: true,
    },
    {
        title: "Divyangjan Swavalamban Yojana (Concessional Livelihood Loans)",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "National Divyangjan Finance and Development Corporation (NDFDC)",
        eligibilityRules: {
            minAge: 18,
            maxAge: 65,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["shopkeeper_msme", "artisan_craftsperson", "unemployed", "ALL"],
            maxAnnualIncome: "5_to_8_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: true,
        },
        rawExtractedText: `Divyangjan Swavalamban Yojana provides concessional financial assistance to Persons with Disabilities (minimum 40% disability certified).
Loans up to ₹50,000 at 5% interest rate per annum.
Loans up to ₹5 Lakh at 6% interest rate for self-employment kiosks, artisan workshops, and micro-enterprises.
Special rebate of 1% interest rate for women with disabilities.`,
        officialPortalUrl: "https://ndfdc.nic.in",
        tags: ["Divyangjan", "Specially Abled", "Micro Loan", "Self Employment", "Subsidies"],
        isActive: true,
    },

    // ─── SENIOR CITIZENS WELFARE ────────────────────────────────────────────
    {
        title: "Rashtriya Vayoshri Yojana (Senior Citizens Assisted Living Aids)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Social Justice and Empowerment",
        eligibilityRules: {
            minAge: 60,
            maxAge: 120,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "below_1_lakh",
            requiresRationCard: true,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Rashtriya Vayoshri Yojana provides physical aids and assisted-living devices for Senior Citizens belonging to BPL category.
Eligible citizens receive free walking sticks, elbow crutches, walkers, tripods, quadpods, hearing aids, wheelchair, artificial dentures, and spectacles.
Distribution camps organized across all districts via ALIMCO.`,
        officialPortalUrl: "https://socialjustice.gov.in",
        tags: ["Senior Citizens", "Healthcare", "BPL", "Assistive Aids", "Elderly Care"],
        isActive: true,
    },

    // ─── MADHYA PRADESH ─────────────────────────────────────────────────────
    {
        title: "Mukhyamantri Ladli Behna Yojana (Madhya Pradesh)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Madhya Pradesh",
        issuingAuthority: "Department of Women and Child Development, Government of Madhya Pradesh",
        eligibilityRules: {
            minAge: 21,
            maxAge: 60,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "1_to_2.5_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Mukhyamantri Ladli Behna Yojana provides financial empowerment to women residing in Madhya Pradesh.
Entitlement: Monthly direct cash transfer of ₹1,250 directly into the woman's Aadhaar-linked bank account (₹15,000 annually).
Eligibility: Married, widowed, divorced, or abandoned women aged 21 to 60 residing in MP whose annual family income is below ₹2.5 Lakh.`,
        officialPortalUrl: "https://cmladlibahna.mp.gov.in",
        tags: ["Women & Child", "Direct Cash Transfer", "Madhya Pradesh", "State Scheme", "Empowerment"],
        isActive: true,
    },
    {
        title: "MP Mukhyamantri Seekho-Kamao Yojana (Learn and Earn Scheme)",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Madhya Pradesh",
        issuingAuthority: "Department of Technical Education, Skill Development and Employment, Madhya Pradesh",
        eligibilityRules: {
            minAge: 18,
            maxAge: 29,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["student", "unemployed", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `MP Seekho Kamao Yojana provides on-the-job industrial skill training with direct monthly stipends to youth in Madhya Pradesh.
Monthly Stipend:
1. 12th Pass trainees: ₹8,000/month.
2. ITI Pass trainees: ₹8,500/month.
3. Diploma holders: ₹9,000/month.
4. Graduate and Post-Graduate youth: ₹10,000/month.
Over 700 recognized job roles across engineering, electronics, retail, and IT.`,
        officialPortalUrl: "https://mmsky.mp.gov.in",
        tags: ["Youth & Skill", "Education", "Stipend", "Madhya Pradesh", "Employment"],
        isActive: true,
    },

    // ─── RAJASTHAN ──────────────────────────────────────────────────────────
    {
        title: "Mukhyamantri Anuprati Coaching Yojana (Rajasthan Free Competitive Coaching)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Rajasthan",
        issuingAuthority: "Social Justice and Empowerment Department, Government of Rajasthan",
        eligibilityRules: {
            minAge: 16,
            maxAge: 32,
            genders: ["ALL"],
            castes: ["sc", "st", "obc", "ews"],
            religions: ["minority", "ALL"],
            occupations: ["student", "ALL"],
            maxAnnualIncome: "5_to_8_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Mukhyamantri Anuprati Coaching Yojana provides free coaching at reputed institutes for meritorious students in Rajasthan preparing for UPSC Civil Services, RPSC, JEE, NEET, CA-FC, CLAT, and Banking exams.
Students studying in institutes outside their home district receive an additional ₹40,000 annual boarding and lodging allowance.`,
        officialPortalUrl: "https://sje.rajasthan.gov.in",
        tags: ["Education", "Coaching", "Rajasthan", "SC/ST/OBC", "State Scheme"],
        isActive: true,
    },
    {
        title: "Rajasthan Palanhar Yojana (Support for Orphan & Vulnerable Children)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Rajasthan",
        issuingAuthority: "Department of Social Justice and Empowerment, Rajasthan",
        eligibilityRules: {
            minAge: 0,
            maxAge: 18,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["student", "ALL"],
            maxAnnualIncome: "below_1_lakh",
            requiresRationCard: true,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Palanhar Yojana provides institutional family-care financial assistance for orphan children and children of destitute widows or disabled parents in Rajasthan.
Entitlements:
- ₹1,500 monthly grant for children aged 0 to 6 years.
- ₹2,500 monthly grant for children aged 6 to 18 years enrolled in school.
- Annual one-time grant of ₹2,000 for clothes, shoes, and educational supplies.`,
        officialPortalUrl: "https://palanhar.rajasthan.gov.in",
        tags: ["Child Welfare", "Education", "Rajasthan", "Social Security", "BPL"],
        isActive: true,
    },

    // ─── WEST BENGAL ────────────────────────────────────────────────────────
    {
        title: "Kanyashree Prakalpa (West Bengal Girls Education Incentive)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "West Bengal",
        issuingAuthority: "Department of Women and Child Development and Social Welfare, West Bengal",
        eligibilityRules: {
            minAge: 13,
            maxAge: 19,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["student"],
            maxAnnualIncome: "1_to_2.5_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Kanyashree Prakalpa is a United Nations Public Service Award-winning conditional cash transfer scheme to prevent child marriage and promote secondary education for girls in West Bengal.
Tiers:
1. K1 Annual Scholarship: ₹1,000 per year for unmarried girls studying in classes VIII to XII.
2. K2 One-Time Grant: ₹25,000 on turning 18, provided the girl is unmarried and enrolled in higher education or vocational training.`,
        officialPortalUrl: "https://wbkanyashree.gov.in",
        tags: ["Women & Child", "Education", "West Bengal", "Girl Child", "State Scheme"],
        isActive: true,
    },
    {
        title: "Lakshmir Bhandar Scheme (West Bengal Women Basic Income)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "West Bengal",
        issuingAuthority: "Women and Child Development Department, West Bengal",
        eligibilityRules: {
            minAge: 25,
            maxAge: 60,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Lakshmir Bhandar provides basic income support to female heads of families in West Bengal.
Benefits:
- SC/ST Category women: ₹1,200 per month directly into bank account (₹14,400 per year).
- General/OBC Category women: ₹1,000 per month (₹12,000 per year).
Enrolled through Duare Sarkar camps across all gram panchayats and municipal wards.`,
        officialPortalUrl: "https://socialwelfare.wb.gov.in",
        tags: ["Women & Child", "Direct Cash Transfer", "West Bengal", "State Scheme", "Social Security"],
        isActive: true,
    },

    // ─── GUJARAT ────────────────────────────────────────────────────────────
    {
        title: "Mukhyamantri Mahila Utkarsh Yojana (Gujarat Interest-Free Women SHG Loans)",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Gujarat",
        issuingAuthority: "Women and Child Development Department, Government of Gujarat",
        eligibilityRules: {
            minAge: 18,
            maxAge: 60,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["women_entrepreneur", "artisan_craftsperson", "shopkeeper_msme", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `MMUY provides 0% interest loans up to ₹1,00,000 to Joint Liability and Earning Groups (JLEG) of women in Gujarat.
The entire interest component is paid directly by the Gujarat State Government to lending banks.
Aims to empower rural and urban women micro-entrepreneurs.`,
        officialPortalUrl: "https://wcd.gujarat.gov.in",
        tags: ["Women & Child", "0% Interest Loan", "Gujarat", "Self Help Groups", "MSME"],
        isActive: true,
    },
    {
        title: "Kisan Suryodaya Yojana (Gujarat Daytime Solar Agricultural Power)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Gujarat",
        issuingAuthority: "Energy and Petrochemicals Department, Government of Gujarat",
        eligibilityRules: {
            minAge: 18,
            maxAge: 85,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["farmer", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Kisan Suryodaya Yojana provides 3-phase agricultural power supply during daytime (5:00 AM to 9:00 PM) to farmers across Gujarat for irrigation.
Eliminates the danger and hardship of night-time irrigation in farmlands. Supported by dedicated 66kV transmission sub-stations.`,
        officialPortalUrl: "https://gujaratindia.gov.in",
        tags: ["Agriculture", "Irrigation", "Gujarat", "Farmers", "Solar Energy"],
        isActive: true,
    },

    // ─── TELANGANA & ANDHRA PRADESH ─────────────────────────────────────────
    {
        title: "Rythu Bharosa / Rythu Bandhu (Telangana Farmer Investment Support)",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Telangana",
        issuingAuthority: "Department of Agriculture and Cooperation, Government of Telangana",
        eligibilityRules: {
            minAge: 18,
            maxAge: 90,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["farmer", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Rythu Bharosa provides direct investment support of ₹15,000 per acre per year (₹7,500 per crop season for Kharif and Rabi) to agricultural landholders and tenant farmers in Telangana.
Funds are directly credited via DBT to buy seeds, fertilizers, and field labor.`,
        officialPortalUrl: "https://rythubandhu.telangana.gov.in",
        tags: ["Agriculture", "Farmers", "Direct Benefit Transfer", "Telangana", "State Scheme"],
        isActive: true,
    },
    {
        title: "Jagananna Amma Vodi (Andhra Pradesh Mother Education Incentive)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Andhra Pradesh",
        issuingAuthority: "Department of School Education, Government of Andhra Pradesh",
        eligibilityRules: {
            minAge: 18,
            maxAge: 65,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "below_1_lakh",
            requiresRationCard: true,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Jagananna Amma Vodi deposits ₹15,000 per academic year directly into the bank account of verified mothers living below poverty line who enroll their children in Class I to XII in recognized schools or junior colleges across Andhra Pradesh.
Requires minimum 75% student classroom attendance.`,
        officialPortalUrl: "https://jaganannaammavodi.ap.gov.in",
        tags: ["Education", "Women & Child", "Direct Benefit Transfer", "Andhra Pradesh", "BPL"],
        isActive: true,
    },

    // ─── KERALA ─────────────────────────────────────────────────────────────
    {
        title: "Karunya Arogya Suraksha Padhathi (KASP - Kerala Universal Health Scheme)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Kerala",
        issuingAuthority: "Department of Health & Family Welfare, Government of Kerala",
        eligibilityRules: {
            minAge: 0,
            maxAge: 120,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "below_1_lakh",
            requiresRationCard: true,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `KASP converges Ayushman Bharat with state health safety nets, providing cashless inpatient healthcare coverage of ₹5,00,000 per family per year to vulnerable families in Kerala across empaneled public and private specialty hospitals.
Covers oncology, cardiology, neurosurgery, and secondary hospital treatments.`,
        officialPortalUrl: "https://sha.kerala.gov.in",
        tags: ["Healthcare", "Health Insurance", "Kerala", "Cashless Treatment", "State Scheme"],
        isActive: true,
    },

    // ─── ODISHA ─────────────────────────────────────────────────────────────
    {
        title: "KALIA Scheme (Krushak Assistance for Livelihood & Income Augmentation)",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Odisha",
        issuingAuthority: "Department of Agriculture & Farmers' Empowerment, Government of Odisha",
        eligibilityRules: {
            minAge: 18,
            maxAge: 85,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["farmer", "unemployed", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `KALIA Scheme provides comprehensive financial assistance to small, marginal farmers, and landless agricultural households in Odisha.
Key Entitlements:
- Financial aid of ₹10,000 per family for cultivation inputs (₹5,000 each for Kharif and Rabi).
- ₹12,500 grant for landless agricultural households to establish goat rearing, mini poultry, mushroom cultivation, or duckery units.
- Interest-free crop loans up to ₹50,000.`,
        officialPortalUrl: "https://kalia.odisha.gov.in",
        tags: ["Agriculture", "Farmers", "Odisha", "Direct Benefit Transfer", "Rural Livelihood"],
        isActive: true,
    },

    // ─── PUNJAB & HARYANA ───────────────────────────────────────────────────
    {
        title: "Mukhyamantri Parivar Samridhi Yojana (Haryana Family Social Security)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Haryana",
        issuingAuthority: "Citizen Resources Information Department (CRID), Government of Haryana",
        eligibilityRules: {
            minAge: 18,
            maxAge: 60,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "1_to_2.5_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `MMPSY provides ₹6,000 per family per year to eligible families in Haryana identified via Parivar Pehchan Patra (PPP) with family income up to ₹1.80 Lakh.
The funds are utilized to pay premium for PMJJBY, PMSBY, PM-SYM pension, and PMFBY crop insurance, with remaining balance transferred to bank accounts.`,
        officialPortalUrl: "https://cm-psy.haryana.gov.in",
        tags: ["Social Welfare", "Haryana", "Direct Cash Transfer", "Pension", "State Scheme"],
        isActive: true,
    },

    // ─── ASSAM & NORTH EAST ─────────────────────────────────────────────────
    {
        title: "Orunodoi 3.0 (Assam DBT Women Empowerment & Social Security)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Assam",
        issuingAuthority: "Finance Department, Government of Assam",
        eligibilityRules: {
            minAge: 18,
            maxAge: 70,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "1_to_2.5_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Orunodoi 3.0 is Assam's largest direct benefit transfer scheme targeting low-income female householders.
Beneficiaries receive ₹1,250 every month on the 10th directly in their bank account to purchase medicines, pulses, fruits, and sugar.
Priority is accorded to households with specially abled members, widowed or unmarried adult women.`,
        officialPortalUrl: "https://finance.assam.gov.in",
        tags: ["Women & Child", "Assam", "Direct Cash Transfer", "Nutrition", "State Scheme"],
        isActive: true,
    },
];

/**
 * Computes deterministic SHA-256 hash for document content.
 */
export const computeContentHash = (title = "", text = "") => {
    return crypto
        .createHash("sha256")
        .update(`${title.trim()}::${text.slice(0, 500).trim()}`)
        .digest("hex");
};

/**
 * Autonomous Government Schemes Synchronizer Service.
 * Manages continuous ingestion across Central PIB bureaus, Regional State bureaus, and all 36 States/UTs.
 */
export const governmentSyncService = {
    /**
     * Polls and synchronizes PIB press releases across regional bureaus.
     */
    syncRegionalPibFeeds: async ({
        bureauCodes = [48, 3, 30, 14, 22, 10, 26], // Central, MH, UP, KA, TN, WB, BR
        limitPerBureau = 3,
        fetchFn = globalThis.fetch,
    } = {}) => {
        const stats = {
            totalInspected: 0,
            syncedCount: 0,
            skippedCount: 0,
            indexedCount: 0,
            errors: [],
        };

        const targetBureaus = PIB_REGIONAL_BUREAUS.filter((b) =>
            bureauCodes.includes(b.code)
        );

        for (const bureau of targetBureaus) {
            try {
                const response = await fetchFn(bureau.url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (compatible; LokSetuAutonomousGovSync/1.0)",
                        Accept: "application/xml, text/xml, */*",
                    },
                });

                if (!response.ok) {
                    stats.errors.push(`Bureau ${bureau.name}: HTTP ${response.status}`);
                    continue;
                }

                const xmlText = await response.text();
                const rawItems = parsePibRssXml(xmlText);
                const candidates = rawItems.slice(0, limitPerBureau);
                stats.totalInspected += candidates.length;

                for (const item of candidates) {
                    // Check duplicate
                    const existing = await Document.findOne({
                        $or: [{ officialPortalUrl: item.link }, { title: item.title }],
                    });

                    if (existing) {
                        stats.skippedCount++;
                        continue;
                    }

                    // Fetch full release content
                    const iframeUrl = item.prid
                        ? `https://pib.gov.in/PressReleaseIframePage.aspx?PRID=${item.prid}`
                        : item.link;

                    let releaseText = item.title;
                    try {
                        const pageRes = await fetchFn(iframeUrl, {
                            headers: { "User-Agent": "Mozilla/5.0" },
                        });
                        if (pageRes.ok) {
                            const html = await pageRes.text();
                            const cleaned = extractPibReleaseContent(html);
                            if (cleaned && cleaned.length > 80) {
                                releaseText = cleaned;
                            }
                        }
                    } catch (_err) {
                        // Fall back to title
                    }

                    // Gemini AI extraction
                    const prompt = `
Analyze the official Indian government release:
TITLE: "${item.title}"
BUREAU: "${bureau.name}" (${bureau.state})
URL: "${item.link}"
CONTENT:
${releaseText.slice(0, 4000)}

Determine if this is an official welfare scheme, government subsidy, citizen policy update, statutory regulation, or public infrastructure announcement that impacts citizens or businesses.
If YES: Extract structured parameters including complete eligibility rules according to schema.
If NO: Set isCivicPolicyOrWelfare to false.
`;

                    const classification = await generateStructuredJson({
                        prompt,
                        responseSchema: GOV_SCHEME_NORMALIZATION_SCHEMA,
                        systemInstruction:
                            "You are the official policy classifier for Lok-Setu. Accurately identify genuine citizen welfare policies, schemes, and statutory notifications across Indian central and state administrations.",
                    });

                    // 2-second rate-limiting delay
                    await new Promise((r) => setTimeout(r, 2000));

                    if (!classification?.isCivicPolicyOrWelfare) {
                        stats.skippedCount++;
                        continue;
                    }

                    const doc = await Document.create({
                        title: classification.title || item.title,
                        documentType: classification.documentType || DOCUMENT_TYPES.GOVERNMENT_NOTIFICATION,
                        jurisdictionLevel: classification.jurisdictionLevel || JURISDICTION_LEVELS.STATE,
                        applicableState: classification.applicableState || bureau.state,
                        applicableDistrict: "ALL",
                        issuingAuthority: classification.issuingAuthority || bureau.name,
                        eligibilityRules: {
                            minAge: classification.eligibilityRules?.minAge ?? 0,
                            maxAge: classification.eligibilityRules?.maxAge ?? 120,
                            genders: classification.eligibilityRules?.genders?.length ? classification.eligibilityRules.genders : ["ALL"],
                            castes: classification.eligibilityRules?.castes?.length ? classification.eligibilityRules.castes : ["ALL"],
                            religions: classification.eligibilityRules?.religions?.length ? classification.eligibilityRules.religions : ["ALL"],
                            occupations: classification.eligibilityRules?.occupations?.length ? classification.eligibilityRules.occupations : ["ALL"],
                            maxAnnualIncome: classification.eligibilityRules?.maxAnnualIncome || "any",
                            requiresRationCard: !!classification.eligibilityRules?.requiresRationCard,
                            requiresDisabilityStatus: !!classification.eligibilityRules?.requiresDisabilityStatus,
                        },
                        rawExtractedText: `${classification.title}\n\n${classification.summary}\n\n${releaseText}`,
                        officialPortalUrl: item.link,
                        officialSourceUrl: item.link,
                        tags: classification.tags || ["Civic Policy", "Government Update"],
                        isActive: true,
                        notificationDate: new Date(),
                        contentHash: computeContentHash(classification.title || item.title, releaseText),
                    });

                    stats.syncedCount++;

                    // Automatic Vector Indexing
                    try {
                        await indexingService.indexDocument(doc._id);
                        stats.indexedCount++;
                    } catch (idxErr) {
                        console.error(`⚠️ Indexing failed for doc ${doc._id}:`, idxErr.message);
                    }
                }
            } catch (bureauErr) {
                stats.errors.push(`Bureau ${bureau.name} error: ${bureauErr.message}`);
            }
        }

        return stats;
    },

    /**
     * Synchronizes and verifies the National Comprehensive Scheme Catalog
     * across all 28 States and key demographic sectors (Divyangjan, Senior Citizens, Women, Youth, Farmers, MSME).
     */
    syncNationalStateCatalog: async () => {
        const stats = {
            totalConsidered: NATIONAL_BASELINE_SCHEMES.length,
            syncedCount: 0,
            skippedCount: 0,
            indexedCount: 0,
        };

        for (const item of NATIONAL_BASELINE_SCHEMES) {
            const existing = await Document.findOne({
                title: item.title,
            });

            if (existing) {
                stats.skippedCount++;
                continue;
            }

            const doc = await Document.create({
                ...item,
                applicableDistrict: "ALL",
                contentHash: computeContentHash(item.title, item.rawExtractedText),
                notificationDate: new Date(),
                officialSourceUrl: item.officialPortalUrl,
            });

            stats.syncedCount++;

            try {
                await indexingService.indexDocument(doc._id);
                stats.indexedCount++;
            } catch (err) {
                console.error(`⚠️ Vector indexing failed for '${item.title}':`, err.message);
            }
        }

        return stats;
    },

    /**
     * Master Autonomous Synchronization Entry Point.
     * Coordinates national catalog completeness and real-time regional live feed polling.
     */
    runFullAutonomousSync: async (options = {}) => {
        const catalogStats = await governmentSyncService.syncNationalStateCatalog();

        let pibStats = {
            totalInspected: 0,
            syncedCount: 0,
            skippedCount: 0,
            indexedCount: 0,
            errors: [],
        };

        if (options.includeLivePib !== false) {
            try {
                pibStats = await governmentSyncService.syncRegionalPibFeeds({
                    bureauCodes: options.bureauCodes || [48, 3, 30, 14, 22],
                    limitPerBureau: options.limitPerBureau || 2,
                    fetchFn: options.fetchFn || globalThis.fetch,
                });
            } catch (pibErr) {
                pibStats.errors.push(pibErr.message);
            }
        }

        return {
            timestamp: new Date().toISOString(),
            catalog: catalogStats,
            livePib: pibStats,
            totalNewDocumentsSynced: catalogStats.syncedCount + pibStats.syncedCount,
            totalIndexedChunks: catalogStats.indexedCount + pibStats.indexedCount,
        };
    },
};
