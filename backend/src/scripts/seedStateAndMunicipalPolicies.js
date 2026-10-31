import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import mongoose from "mongoose";
import connectDB from "../db/index.js";
import { Document } from "../models/document.model.js";
import { indexingService } from "../services/indexing.service.js";
import { DOCUMENT_TYPES, JURISDICTION_LEVELS } from "../constants.js";

export const stateAndMunicipalPolicies = [
    // ─── STATE LEVEL POLICIES ───────────────────────────────────────────────
    {
        title: "Mukhyamantri Majhi Ladki Bahin Yojana (Maharashtra)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Maharashtra",
        applicableDistrict: "ALL",
        issuingAuthority: "Women and Child Development Department, Government of Maharashtra",
        eligibilityRules: {
            minAge: 21,
            maxAge: 65,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "below_2.5_lakh",
            requiresRationCard: true,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Government of Maharashtra Resolution on Mukhyamantri Majhi Ladki Bahin Yojana.
Provides direct monthly financial assistance of ₹1,500 to women residents of Maharashtra aged 21 to 65 years whose combined annual family income does not exceed ₹2.5 Lakh. Beneficiaries must possess an Aadhaar-linked bank account, ration card (yellow or orange), and state domicile certificate.`,
        officialPortalUrl: "https://ladkibahin.maharashtra.gov.in",
        tags: ["Women Welfare", "Direct Benefit Transfer", "Maharashtra", "State Scheme"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Gruha Lakshmi Scheme (Karnataka)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Karnataka",
        applicableDistrict: "ALL",
        issuingAuthority: "Department of Women and Child Development, Government of Karnataka",
        eligibilityRules: {
            minAge: 18,
            maxAge: 100,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: true,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Government of Karnataka Guarantee Scheme: Gruha Lakshmi.
Provides ₹2,000 per month financial grant to the woman head of every household across Karnataka holding an Antyodaya, BPL, or APL ration card issued by the Food and Civil Supplies Department. Women or husbands paying GST or income tax are excluded.`,
        officialPortalUrl: "https://sevasindhu.karnataka.gov.in",
        tags: ["Women Empowerment", "Karnataka", "Guarantee Scheme", "State Scheme"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Delhi Solar Energy Policy 2024–2027 (NCT of Delhi)",
        documentType: DOCUMENT_TYPES.GOVERNMENT_NOTIFICATION,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Delhi",
        applicableDistrict: "Delhi",
        issuingAuthority: "Department of Power, Government of NCT of Delhi",
        eligibilityRules: {
            minAge: 18,
            maxAge: 100,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Government of NCT of Delhi Gazette Notification on Delhi Solar Policy.
Every domestic electricity consumer in Delhi who installs rooftop solar panels receives a Generation-Based Incentive (GBI) of ₹3 per kWh for systems up to 3 kW for 5 years, along with zero electricity bills under net metering. Commercial and industrial installations receive ₹1 per kWh GBI.`,
        officialPortalUrl: "https://solar.delhi.gov.in",
        tags: ["Clean Energy", "Subsidies", "Delhi", "Power", "State Policy"],
        isActive: true,
        notificationDate: new Date(),
    },

    // ─── MUNICIPAL LEVEL ORDERS & REGULATIONS ────────────────────────────────
    {
        title: "MCD Mandatory Commercial Solid Waste Segregation & Fire Safety Order",
        documentType: DOCUMENT_TYPES.CIRCULAR,
        jurisdictionLevel: JURISDICTION_LEVELS.MUNICIPAL,
        applicableState: "Delhi",
        applicableDistrict: "Delhi",
        issuingAuthority: "Municipal Corporation of Delhi (MCD), Public Health & Sanitation Department",
        eligibilityRules: {
            minAge: 18,
            maxAge: 100,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["shopkeeper_msme", "street_vendor", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Municipal Corporation of Delhi (MCD) Order No. MCD/PH/2026/894.
Pursuant to the Solid Waste Management Rules 2016 and Delhi Municipal Corporation Act 1957:
1. All commercial shops, restaurants, and eateries must install separate color-coded bins for wet (green) and dry (blue) waste.
2. Mandatory inspection of functional ABC type dry chemical powder fire extinguishers before December 2026.
3. Failure to comply will attract a spot compounding fine of ₹1,000 for the first offense and ₹5,000 per recurring day under Section 469.
4. Any shopkeeper aggrieved by this order has a statutory right to appeal to the Zonal Deputy Commissioner within 15 days of notice.`,
        officialPortalUrl: "https://mcdonline.nic.in",
        tags: ["Municipal Order", "Shopkeeper Compliance", "Waste Segregation", "MCD Delhi"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "BMC Trade License & Shop Act Online Renewal Circular (Mumbai)",
        documentType: DOCUMENT_TYPES.CIRCULAR,
        jurisdictionLevel: JURISDICTION_LEVELS.MUNICIPAL,
        applicableState: "Maharashtra",
        applicableDistrict: "Mumbai",
        issuingAuthority: "Brihanmumbai Municipal Corporation (BMC), Shops and Establishments Department",
        eligibilityRules: {
            minAge: 18,
            maxAge: 100,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["shopkeeper_msme", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Brihanmumbai Municipal Corporation Circular No. BMC/SE/2026/112.
All business owners and commercial establishments under Mumbai municipal limits must renew their trade permits under Section 394 of the Mumbai Municipal Corporation (MMC) Act 1888 exclusively via the BMC online citizen portal.
Late renewals after 31 March attract a mandatory 25% compounding penalty. Small retail stores under 100 sq. ft. are exempted from health inspector verification fees.`,
        officialPortalUrl: "https://portal.mcgm.gov.in",
        tags: ["Municipal Order", "Trade License", "Shopkeepers", "BMC Mumbai"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Lucknow Nagar Nigam Property Tax Self-Assessment & 10% Early Bird Rebate",
        documentType: DOCUMENT_TYPES.GOVERNMENT_NOTIFICATION,
        jurisdictionLevel: JURISDICTION_LEVELS.MUNICIPAL,
        applicableState: "Uttar Pradesh",
        applicableDistrict: "Lucknow",
        issuingAuthority: "Lucknow Municipal Corporation (LMC), Revenue Department",
        eligibilityRules: {
            minAge: 18,
            maxAge: 100,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Lucknow Municipal Corporation Public Circular No. LMC/REV/2026/401.
Citizens and commercial property holders in all 8 zones of Lucknow Nagar Nigam are notified that the Annual Rental Value (ARV) property tax self-assessment portal is live.
A 10% rebate is provided on current year municipal tax if paid before 31 December. Senior citizens and women property owners receive an additional 5% concession. Late payments after 31 March attract 12% annual interest.`,
        officialPortalUrl: "https://lmc.up.nic.in",
        tags: ["Municipal Law", "Property Tax", "Rebate", "Lucknow Nagar Nigam", "Uttar Pradesh"],
        isActive: true,
        notificationDate: new Date(),
    },
];

export async function seedMultiTierPolicies() {
    await connectDB();
    console.log("🏛️ [Multi-Tier Seeder] Seeding State & Municipal Policies into Lok Setu...");

    let createdCount = 0;
    for (const policy of stateAndMunicipalPolicies) {
        const doc = await Document.findOneAndUpdate(
            { title: policy.title },
            { $set: policy },
            { upsert: true, new: true }
        );
        console.log(` ✅ [${doc.jurisdictionLevel.toUpperCase()}] ${doc.title} (${doc.applicableState})`);

        // Vector index chunk for Civic Assistant RAG
        try {
            await indexingService.indexDocument(doc._id);
        } catch (e) {
            console.warn(`    ⚠️ Index notice for ${doc.title}:`, e.message);
        }
        createdCount++;
    }

    console.log(`\n🎉 [Multi-Tier Seeder] Successfully seeded and indexed ${createdCount} State & Municipal documents!`);
}

// Direct execution guard
if (process.argv[1]?.endsWith("seedStateAndMunicipalPolicies.js")) {
    seedMultiTierPolicies()
        .then(() => {
            console.log("🔒 Seeding complete.");
            process.exit(0);
        })
        .catch((err) => {
            console.error("❌ Seeding failed:", err);
            process.exit(1);
        });
}

