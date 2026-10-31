import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import mongoose from "mongoose";
import connectDB from "../db/index.js";
import { Document } from "../models/document.model.js";
import { indexingService } from "../services/indexing.service.js";
import { DOCUMENT_TYPES, JURISDICTION_LEVELS } from "../constants.js";
import crypto from "crypto";

const computeHash = (title = "", text = "") => {
    return crypto
        .createHash("sha256")
        .update(`${title.trim()}::${text.slice(0, 500).trim()}`)
        .digest("hex");
};

export const panIndiaAllStatesCatalog = [
    // ══════════════════════════════════════════════════════════════════════════
    // 1. PUNJAB
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Mukh Mantri Sehat Bima Yojana (Punjab Universal Health Protection)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Punjab",
        issuingAuthority: "State Health Agency, Department of Health and Family Welfare, Government of Punjab",
        eligibilityRules: {
            minAge: 0,
            maxAge: 120,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Mukh Mantri Sehat Bima Yojana (Ayushman Bharat - Mukh Mantri Sehat Bima Yojana) provides cashless secondary and tertiary health treatment up to ₹5,00,000 per family per year to eligible households in Punjab.
Coverage: Covers NFSA smart ration card holders, J-Form registered farmers, registered construction workers, accredited journalists, and small traders under GST.
Cashless treatment is available across 900+ empaneled government and private specialty hospitals across Punjab and Chandigarh.`,
        officialPortalUrl: "https://shapunjab.in",
        tags: ["Healthcare", "Health Insurance", "Punjab", "Cashless Treatment", "Farmers"],
        isActive: true,
    },
    {
        title: "Punjab Ashirwad Scheme (Shagun Financial Grant for Daughters)",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Punjab",
        issuingAuthority: "Department of Social Justice, Empowerment and Minorities, Punjab",
        eligibilityRules: {
            minAge: 18,
            maxAge: 50,
            genders: ["female"],
            castes: ["sc", "obc", "ews"],
            religions: ["minority", "ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "below_1_lakh",
            requiresRationCard: true,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Punjab Ashirwad Scheme (formerly Shagun Scheme) provides direct financial assistance of ₹51,000 to low-income families for the marriage of their daughters.
Eligible: Daughters of Scheduled Castes (SC), Backward Classes (BC), Christian and Muslim minorities, and Economically Weaker Section (EWS) families residing in Punjab with annual income up to ₹32,790.
The girl must be at least 18 years of age at the time of marriage. Amount is directly transferred via DBT into the daughter's bank account.`,
        officialPortalUrl: "https://ashirwad.punjab.gov.in",
        tags: ["Women & Child", "Financial Grant", "Punjab", "SC/ST/OBC", "Marriage Assistance"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 2. HIMACHAL PRADESH
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "HIMCARE Scheme (Himachal Universal Health Care)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Himachal Pradesh",
        issuingAuthority: "Himachal Pradesh Swasthya Bima Yojana Society (HPSBYS)",
        eligibilityRules: {
            minAge: 0,
            maxAge: 120,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `HIMCARE covers all permanent residents of Himachal Pradesh who are not covered under Ayushman Bharat or government medical reimbursement rules.
Entitlement: Cashless inpatient treatment up to ₹5,00,000 per family per year on a family floater basis across all certified public and private hospitals in Himachal Pradesh and premier institutes like PGIMER Chandigarh.
Zero premium for BPL families, registered street vendors, and persons with more than 70% disability.`,
        officialPortalUrl: "https://www.hpsbys.in",
        tags: ["Healthcare", "Health Insurance", "Himachal Pradesh", "Cashless Treatment", "Universal Health"],
        isActive: true,
    },
    {
        title: "Mukhyamantri Swavalamban Yojana (Himachal Youth Livelihood Subsidy)",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Himachal Pradesh",
        issuingAuthority: "Department of Industries, Government of Himachal Pradesh",
        eligibilityRules: {
            minAge: 18,
            maxAge: 45,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["unemployed", "shopkeeper_msme", "women_entrepreneur", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Mukhyamantri Swavalamban Yojana promotes self-employment in manufacturing, service enterprises, and eco-tourism across Himachal Pradesh.
Key Financial Incentives:
1. Capital Investment Subsidy: 25% for male youth (18-45 years), 30% for SC/ST/Divyangjan entrepreneurs, and 35% for women entrepreneurs on project loans up to ₹1 Crore.
2. 5% Interest Subvention for 3 years on institutional bank loans up to ₹60 Lakh.`,
        officialPortalUrl: "https://mmsy.hp.gov.in",
        tags: ["MSME & Business", "Subsidy", "Himachal Pradesh", "Youth & Skill", "Women Entrepreneurship"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 3. UTTARAKHAND
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Atal Ayushman Uttarakhand Yojana (Universal State Healthcare)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Uttarakhand",
        issuingAuthority: "State Health Agency, Government of Uttarakhand",
        eligibilityRules: {
            minAge: 0,
            maxAge: 120,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Atal Ayushman Uttarakhand Yojana provides universal health coverage of up to ₹5 Lakh per family per year to all permanent resident families of Uttarakhand.
Includes all public hospitals and certified private hospitals across Dehradun, Haridwar, Nainital, Almora, and major empanelled hospitals in New Delhi and Chandigarh.
Covers critical surgeries, dialysis, cancer chemotherapy, and emergency trauma care.`,
        officialPortalUrl: "https://ayushmanuttarakhand.org",
        tags: ["Healthcare", "Universal Health", "Uttarakhand", "Cashless Surgery", "State Scheme"],
        isActive: true,
    },
    {
        title: "Nanda Gaura Kanya Dhan Yojana (Uttarakhand Girl Child Education Grant)",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Uttarakhand",
        issuingAuthority: "Department of Women Empowerment and Child Development, Uttarakhand",
        eligibilityRules: {
            minAge: 0,
            maxAge: 20,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["student"],
            maxAnnualIncome: "below_1_lakh",
            requiresRationCard: true,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Nanda Gaura Yojana provides institutional financial grants to institutionalize institutional birth and secondary education of girls in Uttarakhand.
Financial Tranches:
1. Birth Grant: ₹11,000 one-time DBT upon institutional birth of a girl child.
2. 12th Pass Incentive: ₹51,000 one-time DBT upon successfully passing Class 12 from recognized Uttarakhand schools.
Targeted at families with annual income up to ₹72,000 residing in rural and urban Uttarakhand.`,
        officialPortalUrl: "https://nandagaura.uk.gov.in",
        tags: ["Women & Child", "Girl Child", "Education", "Uttarakhand", "DBT"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 4. JHARKHAND
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Jharkhand Mukhyamantri Maiyan Samman Yojana (JMMSY - Women Financial Security)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Jharkhand",
        issuingAuthority: "Department of Women, Child Development and Social Security, Jharkhand",
        eligibilityRules: {
            minAge: 18,
            maxAge: 50,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "1_to_2.5_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `JMMSY provides direct financial assistance of ₹1,000 per month (₹12,000 per year) to adult women residing in Jharkhand.
Beneficiaries: Women aged 18 to 50 who are permanent residents of Jharkhand and whose families hold pink, yellow, or green ration cards or have an annual family income below ₹2.5 Lakh.
Direct electronic cash transfer to Aadhaar-seeded bank accounts on the 15th of each month.`,
        officialPortalUrl: "https://mmmsy.jharkhand.gov.in",
        tags: ["Women & Child", "Direct Cash Transfer", "Jharkhand", "Social Security", "State Scheme"],
        isActive: true,
    },
    {
        title: "Abua Awas Yojana (Jharkhand 3-Room Pucca Housing Scheme)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Jharkhand",
        issuingAuthority: "Rural Development Department, Government of Jharkhand",
        eligibilityRules: {
            minAge: 18,
            maxAge: 80,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "below_1_lakh",
            requiresRationCard: true,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Abua Awas Yojana provides a 100% state-funded pucca house with 3 rooms and a kitchen (31 sq. meters built-up area) to homeless and kutcha-house dwelling families in Jharkhand who were left out of PM Awas Yojana.
Financial Grant: ₹2,00,000 in 4 tranches credited via DBT into the beneficiary's bank account, plus 95 person-days of wage labor under MGNREGA.
Priority given to Primitive Tribal Groups (PVTG), families with specially-abled members, and destitute widows.`,
        officialPortalUrl: "https://aay.jharkhand.gov.in",
        tags: ["Housing", "Rural Development", "Jharkhand", "Pucca House", "BPL"],
        isActive: true,
    },
    {
        title: "Marang Gomke Jaipal Singh Munda Overseas Scholarship (Jharkhand Foreign Education)",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Jharkhand",
        issuingAuthority: "Scheduled Tribe, Scheduled Caste, Minority and Backward Class Welfare Department, Jharkhand",
        eligibilityRules: {
            minAge: 20,
            maxAge: 35,
            genders: ["ALL"],
            castes: ["st", "sc", "obc"],
            religions: ["minority", "ALL"],
            occupations: ["student"],
            maxAnnualIncome: "8_lakh_above",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Marang Gomke Jaipal Singh Munda Overseas Scholarship fully funds post-graduate degree and doctoral studies at top universities in the United Kingdom and Northern Ireland (Oxford, Cambridge, LSE, King's College) for youth from Jharkhand.
Coverage: 100% tuition fees, living expenses, visa fees, and return economy airfare for up to 25 selected students each year from ST, SC, OBC, and minority communities.`,
        officialPortalUrl: "https://mgos.jharkhand.gov.in",
        tags: ["Education", "Scholarship", "Foreign Education", "Jharkhand", "Tribal Welfare"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 5. CHHATTISGARH
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Mahtari Vandan Yojana (Chhattisgarh Direct Women Allowance)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Chhattisgarh",
        issuingAuthority: "Department of Women and Child Development, Government of Chhattisgarh",
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
        rawExtractedText: `Mahtari Vandan Yojana deposits ₹1,000 every month directly into the Aadhaar-linked bank accounts of married women aged 21 and above in Chhattisgarh (₹12,000 annually).
Widowed, divorced, and abandoned women residing in Chhattisgarh are also fully eligible.
Aims to ensure financial independence, household nutrition, and self-esteem for women.`,
        officialPortalUrl: "https://mahtarivandan.cgstate.gov.in",
        tags: ["Women & Child", "Direct Cash Transfer", "Chhattisgarh", "Social Security", "State Scheme"],
        isActive: true,
    },
    {
        title: "Rajiv Gandhi Kisan Nyay Yojana (Chhattisgarh Crop Input Incentive)",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Chhattisgarh",
        issuingAuthority: "Department of Agriculture Development and Farmer Welfare, Chhattisgarh",
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
        rawExtractedText: `Rajiv Gandhi Kisan Nyay Yojana provides input subsidy of ₹9,000 per acre per year to farmers cultivating paddy, maize, pulses, millets (Kodo-Kutki), and oilseeds in Chhattisgarh.
Funds are credited in four quarterly installments directly into bank accounts through DBT to ensure remunerative price compensation and crop diversification.`,
        officialPortalUrl: "https://kisan.cg.nic.in",
        tags: ["Agriculture", "Farmers", "Input Subsidy", "Chhattisgarh", "Crop Diversification"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 6. GOA
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Dayanand Social Security Scheme (Goa Comprehensive Pension Security)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Goa",
        issuingAuthority: "Directorate of Social Welfare, Government of Goa",
        eligibilityRules: {
            minAge: 60,
            maxAge: 120,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "1_to_2.5_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Dayanand Social Security Scheme (DSSS) provides a monthly social security pension of ₹2,000 to ₹3,500 to senior citizens (60+ years), widows, disabled persons (minimum 40% disability), and single adult women residing in Goa for at least 15 years.
Single disabled citizens receive ₹3,500/month; senior citizens receive ₹2,000/month directly in their bank accounts.`,
        officialPortalUrl: "https://socialwelfare.goa.gov.in",
        tags: ["Senior Citizens", "Social Security", "Goa", "Pension", "Divyangjan"],
        isActive: true,
    },
    {
        title: "Griha Aadhar Scheme (Goa Homemakers Monthly Allowance)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Goa",
        issuingAuthority: "Directorate of Women and Child Development, Goa",
        eligibilityRules: {
            minAge: 18,
            maxAge: 60,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "1_to_2.5_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Griha Aadhar provides monthly financial support of ₹1,500 to married homemakers in Goa belonging to middle and lower-income families (income below ₹3 Lakh per annum) to offset price rise and enhance quality of family life.`,
        officialPortalUrl: "https://dwcd.goa.gov.in",
        tags: ["Women & Child", "Direct Cash Transfer", "Goa", "Homemakers", "State Scheme"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 7. JAMMU & KASHMIR
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Ayushman Bharat PM-JAY SEHAT (Jammu & Kashmir Universal Health Cover)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Jammu and Kashmir",
        issuingAuthority: "State Health Agency, Health & Medical Education Department, J&K",
        eligibilityRules: {
            minAge: 0,
            maxAge: 120,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Ayushman Bharat SEHAT covers 100% of the residents of Jammu & Kashmir, irrespective of income or caste criteria.
Entitlement: Cashless secondary and tertiary medical treatment up to ₹5,00,000 per family per year across 24,000+ empanelled public and private hospitals across India.
Portable nationwide with Golden Card.`,
        officialPortalUrl: "https://sha.jk.gov.in",
        tags: ["Healthcare", "Health Insurance", "Jammu and Kashmir", "Universal Health", "Cashless Treatment"],
        isActive: true,
    },
    {
        title: "Mumkin Scheme (Mission Youth J&K Subsidized Commercial Vehicle Livelihood)",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Jammu and Kashmir",
        issuingAuthority: "Mission Youth, Government of Jammu and Kashmir",
        eligibilityRules: {
            minAge: 18,
            maxAge: 35,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["unemployed", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Mumkin Scheme facilitates unemployed youth in Jammu & Kashmir in acquiring small commercial vehicles (mini-trucks, pick-up vans) for livelihood.
Financial Structure: Mission Youth provides 10% of on-road vehicle cost or ₹80,000 (whichever is lower) as upfront subsidy; vehicle manufacturer provides matching 10% discount; commercial bank finances remaining 80% with zero collateral.`,
        officialPortalUrl: "https://missionyouth.jk.gov.in",
        tags: ["Youth & Skill", "Commercial Vehicle", "Jammu and Kashmir", "Self Employment", "Subsidies"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 8. LADAKH (UT)
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Rewa Scheme (Ladakh Financial Assistance for Competitive Coaching)",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Ladakh",
        issuingAuthority: "Administration of Union Territory of Ladakh, Higher Education Department",
        eligibilityRules: {
            minAge: 17,
            maxAge: 32,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["student"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Rewa Scheme provides financial assistance up to ₹1,00,000 for meritorious Ladakhi students undergoing coaching for UPSC Civil Services, state civil services, JEE, and NEET.
Undergraduate students clearing national competitive entrance exams receive a one-time merit award of ₹1,54,000.`,
        officialPortalUrl: "https://ladakh.nic.in",
        tags: ["Education", "Coaching", "Ladakh", "Student Incentive", "Merit Award"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 9. SIKKIM
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Sikkim Aama Yojana (Annual Financial Grant for Non-Working Rural Mothers)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Sikkim",
        issuingAuthority: "Women and Child Development Department, Government of Sikkim",
        eligibilityRules: {
            minAge: 18,
            maxAge: 59,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "1_to_2.5_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Aama Yojana provides an annual direct cash grant of ₹40,000 deposited in two installments into the bank account of non-working, unemployed mothers in Sikkim who are listed on the electoral roll.
Aims to inculcate saving habits and financial self-sufficiency among rural mothers.`,
        officialPortalUrl: "https://sikkim.gov.in",
        tags: ["Women & Child", "Direct Cash Transfer", "Sikkim", "Mothers", "Rural Development"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 10. MEGHALAYA
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Megha Health Insurance Scheme (MHIS Phase VI - Universal Healthcare)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Meghalaya",
        issuingAuthority: "State Health Agency, Government of Meghalaya",
        eligibilityRules: {
            minAge: 0,
            maxAge: 120,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `MHIS Phase VI, integrated with PM-JAY, provides universal health insurance coverage up to ₹5,30,000 per family per year to all citizens residing in Meghalaya.
Covers in-patient treatment, day-care surgeries, cancer therapy, cardiovascular procedures, and diagnostic procedures across verified network hospitals.`,
        officialPortalUrl: "https://mhis.org.in",
        tags: ["Healthcare", "Health Insurance", "Meghalaya", "Cashless Treatment", "Tribal Health"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 11. TRIPURA
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Mukhyamantri Yuba Jogayog Yojana (Tripura Internet Grant for Students)",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Tripura",
        issuingAuthority: "Education (Higher) Department, Government of Tripura",
        eligibilityRules: {
            minAge: 18,
            maxAge: 25,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["student"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Mukhyamantri Yuba Jogayog Yojana provides a one-time financial grant of ₹5,000 via DBT to final year undergraduate students in government colleges, universities, and polytechnics across Tripura to procure a digital smartphone for digital learning, employment notifications, and skills.`,
        officialPortalUrl: "https://highereducation.tripura.gov.in",
        tags: ["Education", "Youth & Skill", "Tripura", "Digital Inclusion", "Student Grant"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 12. MANIPUR
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Chief Minister-gi Hakshelgi Tengbang (CMHT Manipur Cashless Health Cover)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Manipur",
        issuingAuthority: "State Health Agency, Directorate of Health Services, Government of Manipur",
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
        rawExtractedText: `CMHT provides cashless healthcare hospitalization up to ₹5,00,000 for critical ailments (cardiovascular, oncology, neurosurgery, burns, renal failure) and ₹2,00,000 for general secondary care to poor and vulnerable families in Manipur.
Free diagnostics, free medicines, and travel allowances up to ₹1,000 per hospital admission.`,
        officialPortalUrl: "https://cmhtmanipur.gov.in",
        tags: ["Healthcare", "Health Insurance", "Manipur", "Cashless Surgery", "Tribal Health"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 13. NAGALAND
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Chief Minister's Health Insurance Scheme (CMHIS Nagaland Universal Health)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Nagaland",
        issuingAuthority: "Nagaland Health Protection Society, Department of Health & Family Welfare",
        eligibilityRules: {
            minAge: 0,
            maxAge: 120,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `CMHIS Nagaland provides universal health coverage of ₹20,00,000 per family per year for state government employees and pensioners, and ₹5,00,000 per family for all indigenous and permanent residents of Nagaland not covered under PM-JAY.
Cashless treatment across empanelled hospitals in Nagaland, Assam, and metro cities.`,
        officialPortalUrl: "https://cmhis.nagaland.gov.in",
        tags: ["Healthcare", "Health Insurance", "Nagaland", "Universal Health", "Cashless Treatment"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 14. MIZORAM
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Socio-Economic Development Policy (SEDP Mizoram Livelihood Grant)",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Mizoram",
        issuingAuthority: "Planning and Programme Implementation Department, Government of Mizoram",
        eligibilityRules: {
            minAge: 18,
            maxAge: 70,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["farmer", "artisan_craftsperson", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `SEDP is Mizoram's flagship rural and urban economic upliftment program providing direct seed capital assistance of up to ₹50,000 to family beneficiaries to establish sustainable agricultural, bamboo, handloom, livestock, and floriculture trades.`,
        officialPortalUrl: "https://sedp.mizoram.gov.in",
        tags: ["Agriculture", "Rural Livelihood", "Mizoram", "Direct Benefit Transfer", "Handloom"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 15. ARUNACHAL PRADESH
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Chief Minister's Krishi Rinn Yojana (Arunachal 0% Interest Agricultural Loans)",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Arunachal Pradesh",
        issuingAuthority: "Department of Agriculture, Government of Arunachal Pradesh",
        eligibilityRules: {
            minAge: 18,
            maxAge: 75,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["farmer", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `CM Krishi Rinn Yojana provides zero-interest agricultural institutional credit up to ₹3,00,000 through commercial and regional rural banks for farmers in Arunachal Pradesh.
State government provides an upfront 4% interest subvention, which combined with Central Government's 3% prompt repayment incentive, makes the effective interest rate 0%.`,
        officialPortalUrl: "https://arunachalpradesh.gov.in",
        tags: ["Agriculture", "0% Interest Loan", "Arunachal Pradesh", "Farmers", "KCC"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 16. PUDUCHERRY (UT)
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Puducherry Old Age Pension & Destitute Women Security Scheme",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Puducherry",
        issuingAuthority: "Department of Social Welfare, Government of Puducherry",
        eligibilityRules: {
            minAge: 55,
            maxAge: 120,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "below_1_lakh",
            requiresRationCard: true,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Provides monthly social security pension of ₹2,500 to ₹3,500 to destitute senior citizens, widows, deserted wives, and unmarried women aged 55 and above residing in Puducherry.
Disabled persons holding red ration cards receive ₹3,800 monthly credited via DBT on the 1st of each calendar month.`,
        officialPortalUrl: "https://socwelfare.py.gov.in",
        tags: ["Senior Citizens", "Social Security", "Puducherry", "Pension", "Women & Child"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 17. CHANDIGARH (UT)
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Chandigarh Divyangjan Social Security Pension & Free Travel Concession",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Chandigarh",
        issuingAuthority: "Department of Social Welfare, Chandigarh Administration",
        eligibilityRules: {
            minAge: 0,
            maxAge: 120,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "below_1_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: true,
        },
        rawExtractedText: `Chandigarh Administration provides a monthly disability pension of ₹2,000 per month directly to residents with minimum 40% certified disability.
Beneficiaries receive 100% free bus travel passes on all CTU local and suburban routes and free assistive hearing/mobility aids through Red Cross Society.`,
        officialPortalUrl: "https://chandigarh.gov.in",
        tags: ["Specially Abled", "Divyangjan", "Chandigarh", "Pension", "Free Travel"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 18. ANDAMAN & NICOBAR ISLANDS (UT)
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Andaman & Nicobar Marine Fishermen Modern Craft & Livelihood Subsidy",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Andaman and Nicobar Islands",
        issuingAuthority: "Directorate of Fisheries, Andaman & Nicobar Administration",
        eligibilityRules: {
            minAge: 18,
            maxAge: 70,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["farmer", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Provides 50% capital subsidy up to ₹1,50,000 for motorized fishing boats, deep-sea gillnets, ice boxes, and GPS communication systems to traditional island fishermen in Port Blair, Car Nicobar, and Mayabunder.
Includes free safety distress radio beacons and monsoon ban sustenance grants.`,
        officialPortalUrl: "https://fisheries.andaman.gov.in",
        tags: ["Fisheries", "Andaman and Nicobar Islands", "Subsidy", "Livelihood", "Coastal Welfare"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 19. DADRA & NAGAR HAVELI AND DAMAN & DIU (UT)
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "DNH & DD Tribal Rooftop Solar & Agro-Forestry Subsidy Scheme",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Dadra and Nagar Haveli and Daman and Diu",
        issuingAuthority: "Department of Tribal Welfare, UT Administration of DNH & DD",
        eligibilityRules: {
            minAge: 18,
            maxAge: 75,
            genders: ["ALL"],
            castes: ["st", "ALL"],
            religions: ["ALL"],
            occupations: ["farmer", "ALL"],
            maxAnnualIncome: "1_to_2.5_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Provides 90% capital subsidy on installation of decentralized 1kW to 3kW solar rooftop systems for tribal households across Silvassa, Daman, and Diu, plus 100% free high-yield saplings (cashew, mango, teak) with borewell irrigation assistance.`,
        officialPortalUrl: "https://daman.nic.in",
        tags: ["Tribal Welfare", "Solar Energy", "Dadra and Nagar Haveli and Daman and Diu", "Agriculture"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 20. LAKSHADWEEP (UT)
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Lakshadweep Island Deep-Sea Tuna Fishermen Support Scheme",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Lakshadweep",
        issuingAuthority: "Department of Fisheries, Union Territory of Lakshadweep",
        eligibilityRules: {
            minAge: 18,
            maxAge: 65,
            genders: ["ALL"],
            castes: ["st", "ALL"],
            religions: ["ALL"],
            occupations: ["farmer", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Provides 60% subsidy on fuel (kerosene/petrol) for outboard fishing motors and mechanized tuna pole-and-line fishing vessels operating from Kavaratti, Agatti, Minicoy, and Andrott.
Includes free insulated fish transport boxes and satellite sea-safety equipment.`,
        officialPortalUrl: "https://lakshadweep.gov.in",
        tags: ["Fisheries", "Lakshadweep", "Subsidy", "Island Welfare", "Tribal Welfare"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 21. NATIONAL TRIBAL & PVTG FLAGSHIPS (CENTRAL)
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "PM-JANMAN (Pradhan Mantri Janjati Adivasi Nyaya Maha Abhiyan)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Tribal Affairs, Government of India",
        eligibilityRules: {
            minAge: 0,
            maxAge: 120,
            genders: ["ALL"],
            castes: ["st"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `PM-JANMAN with a budget outlay of ₹24,104 crore focuses on 75 Particularly Vulnerable Tribal Groups (PVTGs) residing in 18 states and UTs.
Core Interventions:
1. 100% pucca housing under PM-Awas.
2. Piped potable drinking water to all PVTG hamlets under Jal Jeevan Mission.
3. Off-grid solar electrification for remote tribal habitations.
4. Mobile medical units and multi-purpose community resource centres.`,
        officialPortalUrl: "https://tribal.nic.in",
        tags: ["Tribal Welfare", "Central Govt", "Housing", "Clean Water", "Solar Energy"],
        isActive: true,
    },
    {
        title: "Eklavya Model Residential Schools (EMRS Free Quality Tribal Education)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "National Education Society for Tribal Students (NESTS), Ministry of Tribal Affairs",
        eligibilityRules: {
            minAge: 10,
            maxAge: 18,
            genders: ["ALL"],
            castes: ["st"],
            religions: ["ALL"],
            occupations: ["student"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `EMRS establishes world-class CBSE-affiliated residential schools from Class VI to XII across all tribal blocks in India.
100% Free: Complete tuition, boarding, lodging, uniforms, books, medical care, and specialized competitive coaching for JEE, NEET, and CLAT provided entirely free of cost to Scheduled Tribe (ST) students.`,
        officialPortalUrl: "https://emrs.tribal.gov.in",
        tags: ["Education", "Tribal Welfare", "Scholarship", "Central Govt", "CBSE"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 22. UNORGANIZED, GIG & SANITATION WORKERS (CENTRAL)
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "PM-SYM (Pradhan Mantri Shram Yogi Maan-dhan Pension for Unorganized Workers)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Labour and Employment, Government of India",
        eligibilityRules: {
            minAge: 18,
            maxAge: 40,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["street_vendor", "artisan_craftsperson", "unemployed", "ALL"],
            maxAnnualIncome: "1_to_2.5_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `PM-SYM provides a guaranteed monthly pension of ₹3,000 to unorganized workers (street vendors, domestic workers, rickshaw pullers, construction laborers, agricultural laborers, and gig workers) after attaining 60 years of age.
Matching Contribution: Beneficiary contributes ₹55 to ₹200 per month (depending on entry age), and the Central Government deposits an equal 50% matching contribution into the pension fund. Managed by LIC.`,
        officialPortalUrl: "https://maandhan.in",
        tags: ["Social Welfare", "Pension", "Unorganized Sector", "Gig Workers", "Central Govt"],
        isActive: true,
    },
    {
        title: "NAMASTE Scheme (National Action for Mechanised Sanitation Ecosystem)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Social Justice and Empowerment & Ministry of Housing and Urban Affairs",
        eligibilityRules: {
            minAge: 18,
            maxAge: 60,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["sanitation_worker", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `NAMASTE eliminates hazardous manual cleaning of sewers and septic tanks.
Benefits for Sanitation Workers:
1. Capital subsidy up to ₹5,00,000 for purchasing mechanized desludging vacuum suction vehicles.
2. Complete personal protective equipment (PPE kits) and free Ayushman Bharat health insurance.
3. Skill certification and alternative livelihood entrepreneurship training.`,
        officialPortalUrl: "https://socialjustice.gov.in",
        tags: ["Sanitation", "Social Welfare", "Central Govt", "Capital Subsidy", "Health Insurance"],
        isActive: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 23. SPECIAL DISABILITIES & MENTAL HEALTH (CENTRAL)
    // ══════════════════════════════════════════════════════════════════════════
    {
        title: "Niramaya Health Insurance Scheme (Health Cover for Autism, CP, Mental Disabilities)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "The National Trust, Ministry of Social Justice and Empowerment",
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
        rawExtractedText: `Niramaya provides comprehensive health insurance up to ₹1,00,000 per annum for persons with Autism, Cerebral Palsy, Mental Retardation, and Multiple Disabilities.
Coverage includes:
- Inpatient hospitalization: up to ₹55,000.
- Outpatient medical treatment and specialized therapies (speech therapy, behavioral therapy, physiotherapy): up to ₹19,000.
- Dental and corrective surgeries: up to ₹10,000.
Zero premium for families living Below Poverty Line (BPL).`,
        officialPortalUrl: "https://thenationaltrust.gov.in",
        tags: ["Specially Abled", "Divyangjan", "Health Insurance", "Mental Health", "Central Govt"],
        isActive: true,
    },
    {
        title: "ADIP Scheme (Assistance to Disabled Persons for Purchase of Assistive Devices)",
        documentType: DOCUMENT_TYPES.SUBSIDIES_GRANTS,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Department of Empowerment of Persons with Disabilities, MoSJE",
        eligibilityRules: {
            minAge: 0,
            maxAge: 120,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "1_to_2.5_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: true,
        },
        rawExtractedText: `ADIP provides 100% free motorized tricycles, smart canes, digital hearing aids, cochlear implants (up to ₹6 Lakh for children below 5 years), prosthetic limbs, and braille smart kits through ALIMCO for certified disabled individuals whose monthly family income is below ₹15,000.
50% subsidy for income between ₹15,001 and ₹20,000/month.`,
        officialPortalUrl: "https://adip.depwd.gov.in",
        tags: ["Specially Abled", "Divyangjan", "Assistive Aids", "Central Govt", "Prosthetics"],
        isActive: true,
    },
];

/**
 * Ingestion runner: Inserts pan-India schemes and builds vector embeddings in Atlas.
 */
export const runPanIndiaIngestion = async () => {
    console.log("🇮🇳 [Pan-India Seeder] Connecting to MongoDB Atlas...");
    await connectDB();

    console.log(`📦 Catalog contains ${panIndiaAllStatesCatalog.length} new statutory schemes across all States & UTs.`);

    let synced = 0;
    let skipped = 0;
    let indexed = 0;

    for (const item of panIndiaAllStatesCatalog) {
        const exists = await Document.findOne({ title: item.title });
        if (exists) {
            skipped++;
            continue;
        }

        const doc = await Document.create({
            ...item,
            applicableDistrict: "ALL",
            notificationDate: new Date(),
            officialSourceUrl: item.officialPortalUrl,
            contentHash: computeHash(item.title, item.rawExtractedText),
            indexingStatus: "unindexed",
        });

        synced++;

        try {
            await indexingService.indexDocument(doc._id);
            indexed++;
        } catch (err) {
            console.warn(`⚠️ Vector indexing failed for ${item.title}: ${err.message}`);
        }
    }

    const totalInDb = await Document.countDocuments({ isActive: true });

    console.log("\n================ PAN-INDIA SEED RESULTS ================");
    console.log(`✨ Newly Synced: ${synced}`);
    console.log(`⏩ Already Existed: ${skipped}`);
    console.log(`🧠 Indexed in Atlas Vector Search (768-dim): ${indexed}`);
    console.log(`🏛️ Total Active Documents in MongoDB Atlas: ${totalInDb}`);
    console.log("========================================================\n");

    await mongoose.connection.close();
    return { synced, skipped, indexed, totalInDb };
};

// Direct script execution
if (process.argv[1]?.endsWith("seedPanIndiaAllStatesCatalog.js")) {
    runPanIndiaIngestion()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error("❌ Pan-India ingestion failed:", err);
            process.exit(1);
        });
}
