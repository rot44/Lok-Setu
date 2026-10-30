import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import mongoose from "mongoose";
import connectDB from "../db/index.js";
import { Document } from "../models/document.model.js";
import {
    DOCUMENT_TYPES,
    JURISDICTION_LEVELS,
} from "../constants.js";

const realGovernmentSchemes = [
    {
        title: "National Scholarship Portal - Central Sector Scheme",
        documentType: DOCUMENT_TYPES.SCHEME,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Education (Department of Higher Education)",
        eligibilityRules: {
            minAge: 17,
            maxAge: 25,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["student", "ALL"],
            maxAnnualIncome: "below_4.5_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText:
            "One stop platform for scholarship schemes for students across India. Provides financial assistance to meritorious college and university students from economically weaker sections to meet day-to-day educational expenses.",
        officialPortalUrl: "https://scholarships.gov.in",
        tags: ["Education", "Scholarship", "Students", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
        documentType: DOCUMENT_TYPES.SCHEME,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Agriculture & Farmers Welfare",
        eligibilityRules: {
            minAge: 18,
            maxAge: 100,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["farmer", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText:
            "Income support of ₹6,000 per year in three equal installments of ₹2,000 directly transferred into the bank accounts of all landholding farmer families across India.",
        officialPortalUrl: "https://pmkisan.gov.in",
        tags: ["Agriculture", "Income Support", "Farmers", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Ayushman Bharat - PMJAY (Pradhan Mantri Jan Arogya Yojana)",
        documentType: DOCUMENT_TYPES.SCHEME,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "National Health Authority (NHA)",
        eligibilityRules: {
            minAge: 0,
            maxAge: 120,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "below_2.5_lakh",
            requiresRationCard: true,
            requiresDisabilityStatus: false,
        },
        rawExtractedText:
            "Flagship health insurance scheme providing annual health coverage of up to ₹5 lakh per family for secondary and tertiary care hospitalization across impaneled public and private hospitals.",
        officialPortalUrl: "https://pmjay.gov.in",
        tags: ["Healthcare", "Health Insurance", "Families", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Beti Bachao Beti Padhao",
        documentType: DOCUMENT_TYPES.POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Women and Child Development",
        eligibilityRules: {
            minAge: 0,
            maxAge: 21,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText:
            "National initiative ensuring the safety, survival, protection, and holistic empowerment and education of girl children, addressing the declining Child Sex Ratio across Indian districts.",
        officialPortalUrl: "https://wcd.nic.in/bbbp-schemes",
        tags: ["Women & Child", "Girl Child", "Education", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Credit Guarantee Scheme for Micro & Small Enterprises (CGTMSE)",
        documentType: DOCUMENT_TYPES.SCHEME,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Micro, Small & Medium Enterprises",
        eligibilityRules: {
            minAge: 18,
            maxAge: 70,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["business", "self_employed", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText:
            "Collateral-free credit facility up to ₹500 lakh to first-generation entrepreneurs and micro & small enterprises without third-party guarantees.",
        officialPortalUrl: "https://www.cgtmse.in",
        tags: ["MSME & Business", "Loans", "Entrepreneurs", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Pradhan Mantri Awas Yojana (Urban)",
        documentType: DOCUMENT_TYPES.SCHEME,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Housing and Urban Affairs",
        eligibilityRules: {
            minAge: 21,
            maxAge: 70,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "below_6_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText:
            "Affordable housing mission addressing urban housing shortages among EWS/LIG and MIG categories, ensuring pucca houses with basic civic infrastructure for all eligible families.",
        officialPortalUrl: "https://pmaymis.gov.in",
        tags: ["Housing", "Urban Development", "Families", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Mukhyamantri Kanya Sumangala Yojana (Uttar Pradesh)",
        documentType: DOCUMENT_TYPES.SCHEME,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Uttar Pradesh",
        issuingAuthority: "Department of Women and Child Development, Uttar Pradesh",
        eligibilityRules: {
            minAge: 0,
            maxAge: 25,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "below_3_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText:
            "State welfare financial grant of ₹25,000 provided in 6 stages from birth to graduation for female residents of Uttar Pradesh whose family annual income is under ₹3 Lakh.",
        officialPortalUrl: "https://mksy.up.gov.in",
        tags: ["Women & Child", "State Welfare", "Uttar Pradesh", "Education"],
        isActive: true,
        notificationDate: new Date(),
    },
];

const seedSchemes = async () => {
    try {
        await connectDB();

        console.log("🌱 Seeding verified government schemes into database...");

        for (const scheme of realGovernmentSchemes) {
            await Document.findOneAndUpdate(
                { title: scheme.title },
                { $set: scheme },
                { upsert: true, new: true }
            );
            console.log(` ✅ Seeded: ${scheme.title}`);
        }

        console.log(`\n🎉 Successfully seeded ${realGovernmentSchemes.length} real government schemes!`);
        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
};

seedSchemes();
