import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import mongoose from "mongoose";
import connectDB from "../db/index.js";
import { Document } from "../models/document.model.js";
import { indexingService } from "../services/indexing.service.js";
import { DOCUMENT_TYPES, JURISDICTION_LEVELS } from "../constants.js";

export const comprehensiveGovSchemes = [
    // ─── LOANS & MSME / VENDORS ─────────────────────────────────────────────
    {
        title: "PM SVANidhi (Pradhan Mantri Street Vendor’s AtmaNirbhar Nidhi)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Housing and Urban Affairs",
        eligibilityRules: {
            minAge: 18,
            maxAge: 75,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["street_vendor", "shopkeeper_msme", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `PM SVANidhi provides micro-credit working capital loans to urban, peri-urban, and rural street vendors across India.
First tranche: Collateral-free loan up to ₹10,000 with 1-year tenure.
Second tranche: Up to ₹20,000 on timely repayment of first loan.
Third tranche: Up to ₹50,000 on timely repayment of second loan.
Beneficiaries receive a 7% interest subsidy per annum credited directly into their bank account and up to ₹1,200 annual cashback on digital transactions.`,
        officialPortalUrl: "https://pmsvanidhi.mohua.gov.in",
        tags: ["Street Vendors", "Collateral-free Loan", "MSME", "Urban Livelihood", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Pradhan Mantri Mudra Yojana (PMMY)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Finance (Department of Financial Services)",
        eligibilityRules: {
            minAge: 18,
            maxAge: 70,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["shopkeeper_msme", "artisan_craftsperson", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `PMMY provides collateral-free institutional credit to non-corporate, non-farm small and micro enterprises.
Categories of Loans:
1. Shishu: Loans up to ₹50,000 for startup entrepreneurs and small kiosks.
2. Kishore: Loans above ₹50,000 and up to ₹5 Lakh for expanding small businesses.
3. Tarun: Loans above ₹5 Lakh and up to ₹10 Lakh for established enterprises.
Enhanced limit of up to ₹20 Lakh applies for entrepreneurs who have successfully repaid previous Tarun loans under the 2024 revised guidelines. Zero processing fee for Shishu and Kishore loans.`,
        officialPortalUrl: "https://www.mudra.org.in",
        tags: ["Business Loan", "Mudra", "MSME", "Entrepreneurship", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "PM Vishwakarma Scheme",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Micro, Small and Medium Enterprises",
        eligibilityRules: {
            minAge: 18,
            maxAge: 100,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["artisan_craftsperson", "shopkeeper_msme", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `PM Vishwakarma provides holistic end-to-end support to traditional artisans and craftspeople working with their hands across 18 traditional trades (carpenters, blacksmiths, goldsmiths, potters, sculptors, cobblers, tailors, etc.).
Benefits include:
- Official PM Vishwakarma Certificate and ID Card.
- Skill training of 5-7 days with ₹500 per day stipend.
- Modern toolkit incentive of ₹15,000 digital voucher.
- Collateral-free enterprise credit up to ₹1 Lakh (first tranche at 5% concessional interest) and ₹2 Lakh (second tranche).`,
        officialPortalUrl: "https://pmvishwakarma.gov.in",
        tags: ["Artisans", "Craftspeople", "Skill Training", "Toolkit Grant", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Stand-Up India Scheme",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Finance",
        eligibilityRules: {
            minAge: 18,
            maxAge: 75,
            genders: ["female", "ALL"],
            castes: ["sc", "st", "ALL"],
            religions: ["ALL"],
            occupations: ["shopkeeper_msme", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Stand-Up India facilitates bank loans between ₹10 Lakh and ₹1 Crore to at least one Scheduled Caste (SC) or Scheduled Tribe (ST) borrower and at least one woman borrower per bank branch for setting up greenfield enterprises in manufacturing, services, agri-allied, or trading sectors.`,
        officialPortalUrl: "https://www.standupmitra.in",
        tags: ["Women Entrepreneurs", "SC/ST Welfare", "Business Loans", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },

    // ─── SOCIAL SECURITY & PENSION ──────────────────────────────────────────
    {
        title: "Atal Pension Yojana (APY)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Pension Fund Regulatory and Development Authority (PFRDA)",
        eligibilityRules: {
            minAge: 18,
            maxAge: 40,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Atal Pension Yojana is a guaranteed monthly pension scheme for all Indian citizens in the unorganized sector.
Subscribers can choose a fixed monthly pension of ₹1,000, ₹2,000, ₹3,000, ₹4,000, or ₹5,000 per month starting from age 60 until death, based on contributions made between ages 18 and 40.
After subscriber's death, pension continues to the spouse for life, followed by return of full pension corpus to the nominee. Any citizen not paying income tax can join.`,
        officialPortalUrl: "https://www.npscra.nsdl.co.in",
        tags: ["Pension", "Social Security", "Unorganized Sector", "Senior Citizen", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Finance",
        eligibilityRules: {
            minAge: 18,
            maxAge: 50,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `PMJJBY is a one-year life insurance scheme renewable from year to year offering ₹2,00,000 life insurance cover for death due to any reason.
Annual premium is ₹436 per annum, auto-debited from the subscriber's bank or post office savings account in the month of May.`,
        officialPortalUrl: "https://financialservices.gov.in",
        tags: ["Life Insurance", "Social Security", "Low Cost", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Pradhan Mantri Suraksha Bima Yojana (PMSBY)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Finance",
        eligibilityRules: {
            minAge: 18,
            maxAge: 70,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `PMSBY provides accidental death and disability insurance cover of ₹2,00,000 for death or total irrecoverable loss of both eyes or hands/feet, and ₹1,00,000 for total irrecoverable loss of sight of one eye or loss of use of one hand or foot.
Premium is ₹20 per annum, auto-debited in a single installment.`,
        officialPortalUrl: "https://financialservices.gov.in",
        tags: ["Accident Insurance", "Disability Cover", "Low Cost", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Indira Gandhi National Old Age Pension Scheme (IGNOAPS)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Rural Development",
        eligibilityRules: {
            minAge: 60,
            maxAge: 120,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["senior_citizen", "unemployed", "ALL"],
            maxAnnualIncome: "below_1_lakh",
            requiresRationCard: true,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Under the National Social Assistance Programme (NSAP), IGNOAPS provides non-contributory monthly pensions to elderly citizens belonging to Below Poverty Line (BPL) households.
Beneficiaries aged 60 to 79 receive monthly central pension supplemented by state government contribution (ranging ₹500 to ₹2,500/mo depending on state). Citizens aged 80 and above receive enhanced pension.`,
        officialPortalUrl: "https://nsap.nic.in",
        tags: ["Senior Citizen", "Old Age Pension", "BPL", "Social Welfare", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },

    // ─── WOMEN & GIRL CHILD WELFARE ─────────────────────────────────────────
    {
        title: "Sukanya Samriddhi Yojana (SSY)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Finance & Department of Posts",
        eligibilityRules: {
            minAge: 0,
            maxAge: 10,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Sukanya Samriddhi Account is a government-backed small savings scheme launched as part of the 'Beti Bachao Beti Padhao' campaign.
A parent or legal guardian can open an account for a girl child from her birth up to the age of 10 years.
Offers sovereign guaranteed interest rate (8.2% per annum compounding). Deposits qualify for Section 80C tax deduction, and interest earned plus maturity amount are 100% tax-free under EEE status. Matures after 21 years or upon marriage after age 18.`,
        officialPortalUrl: "https://www.indiapost.gov.in",
        tags: ["Girl Child", "High Interest", "Savings", "Tax-Free", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Pradhan Mantri Matru Vandana Yojana (PMMVY)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Women and Child Development",
        eligibilityRules: {
            minAge: 19,
            maxAge: 50,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["homemaker", "ALL"],
            maxAnnualIncome: "below_8_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `PMMVY is a Direct Benefit Transfer (DBT) maternity benefit scheme providing cash incentives to pregnant women and lactating mothers for wage loss and nutritional support.
First child: ₹5,000 in two installments upon antenatal registration and child immunization.
Second child (if female): Additional incentive of ₹6,000 in a single installment to encourage girl child birth ratio.`,
        officialPortalUrl: "https://pmmvy.wcd.gov.in",
        tags: ["Maternity Benefit", "Mother & Child", "Nutrition", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Lakhpati Didi Initiative",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Rural Development (DAY-NRLM)",
        eligibilityRules: {
            minAge: 18,
            maxAge: 65,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["homemaker", "artisan_craftsperson", "farmer", "ALL"],
            maxAnnualIncome: "below_2.5_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Lakhpati Didi is a flagship initiative under Deendayal Antyodaya Yojana - National Rural Livelihoods Mission (DAY-NRLM) aimed at enabling rural Self-Help Group (SHG) women to earn a sustainable income of at least ₹1 Lakh per year (₹10,000+ per month).
Provides access to community investment funds, interest-subvention bank loans, digital financial training, and market linkages for micro-enterprises.`,
        officialPortalUrl: "https://nrlm.gov.in",
        tags: ["Women Empowerment", "SHG", "Rural Livelihood", "Micro Enterprise", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },

    // ─── AGRICULTURE & FARMERS ──────────────────────────────────────────────
    {
        title: "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Agriculture and Farmers Welfare",
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
        rawExtractedText: `PMFBY provides comprehensive crop insurance coverage against non-preventable natural risks (drought, flood, unseasonal rain, pest infestation, hailstorm) from pre-sowing to post-harvest.
Farmers pay a uniform nominal premium of only 2% for Kharif crops, 1.5% for Rabi crops, and 5% for annual commercial/horticultural crops. The remaining premium balance is subsidized equally by Central and State Governments. Claims are settled directly into Aadhaar-seeded accounts.`,
        officialPortalUrl: "https://pmfby.gov.in",
        tags: ["Crop Insurance", "Agriculture", "Farmers", "Climate Risk", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Kisan Credit Card (KCC) Scheme",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Agriculture & NABARD",
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
        rawExtractedText: `The Kisan Credit Card scheme provides farmers with timely institutional short-term credit for cultivation, post-harvest expenses, maintenance of farm assets, and allied activities like dairy and fisheries.
Loans up to ₹3,00,000 carry an effective concessional interest rate of only 4% per annum (after 2% interest subvention and 3% prompt repayment incentive). Collateral-free limit is ₹1.60 Lakh (extended to ₹2.00 Lakh with tie-ups). Includes RuPay debit card facility.`,
        officialPortalUrl: "https://www.nabard.org",
        tags: ["KCC", "Agricultural Credit", "Low Interest", "Farmers", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },

    // ─── HOUSING, ENERGY & SANITATION ───────────────────────────────────────
    {
        title: "PM-Surya Ghar: Muft Bijli Yojana",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of New and Renewable Energy",
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
        rawExtractedText: `PM-Surya Ghar: Muft Bijli Yojana aims to provide up to 300 units of free electricity every month to 1 crore residential households across India by installing rooftop solar systems.
Central Financial Assistance (CFA) subsidy:
- ₹30,000 for 1 kW systems
- ₹60,000 for 2 kW systems
- ₹78,000 for systems 3 kW and above
Collateral-free low-interest bank loans (around 7%) available for the remaining balance. Surplus electricity can be sold back to DISCOM via net metering.`,
        officialPortalUrl: "https://pmsuryaghar.gov.in",
        tags: ["Solar Energy", "Free Electricity", "Subsidy", "Clean Power", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Pradhan Mantri Ujjwala Yojana (PMUY)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Petroleum and Natural Gas",
        eligibilityRules: {
            minAge: 18,
            maxAge: 100,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["homemaker", "ALL"],
            maxAnnualIncome: "below_2.5_lakh",
            requiresRationCard: true,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `PM Ujjwala Yojana provides deposit-free LPG gas connections to adult women from poor and BPL households across India.
Benefits: Free LPG cylinder connection, pressure regulator, safety hose, domestic gas stove, and first refill completely free. Beneficiaries receive a direct targeted subsidy of ₹300 per 14.2 kg cylinder for up to 12 refills per year credited directly to their bank account.`,
        officialPortalUrl: "https://www.pmuy.gov.in",
        tags: ["Clean Cooking", "LPG Subsidy", "Women Welfare", "BPL", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Pradhan Mantri Awas Yojana - Gramin (PMAY-G)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Rural Development",
        eligibilityRules: {
            minAge: 18,
            maxAge: 100,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["farmer", "unemployed", "ALL"],
            maxAnnualIncome: "below_2.5_lakh",
            requiresRationCard: true,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `PMAY-G provides direct financial assistance to homeless rural families and those living in kutcha or dilapidated houses to construct a minimum 25 sq. meter pucca house with a hygienic cooking space.
Financial grant: ₹1,20,000 in plain areas and ₹1,30,000 in hilly/difficult states and UTs.
Additionally, beneficiaries receive ₹12,000 for toilet construction under Swachh Bharat Mission (Grameen) and 90-95 person-days of unskilled labor under MGNREGS.`,
        officialPortalUrl: "https://pmayg.nic.in",
        tags: ["Rural Housing", "Pucca House", "DBT Grant", "Gramin", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Jal Jeevan Mission (Har Ghar Jal)",
        documentType: DOCUMENT_TYPES.GOVERNMENT_NOTIFICATION,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Department of Drinking Water and Sanitation, Ministry of Jal Shakti",
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
        rawExtractedText: `Jal Jeevan Mission is envisioned to provide safe and adequate drinking water through individual Functional Household Tap Connections (FHTC) of 55 liters per capita per day to every rural household across India. Includes water quality monitoring, village water committees, and zero cost for tap connection installation for rural residents.`,
        officialPortalUrl: "https://jaljeevanmission.gov.in",
        tags: ["Clean Water", "Tap Connection", "Rural Infrastructure", "Public Health", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },

    // ─── SKILLS & EDUCATION ─────────────────────────────────────────────────
    {
        title: "Pradhan Mantri Kaushal Vikas Yojana (PMKVY 4.0)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Skill Development and Entrepreneurship (MSDE)",
        eligibilityRules: {
            minAge: 15,
            maxAge: 45,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["student", "unemployed", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `PMKVY 4.0 provides industry-relevant, free short-term skill training and certification to Indian youth to make them employable.
Training includes cutting-edge Industry 4.0 courses: AI, coding, drone technology, robotics, solar technicians, and 3D printing.
Entire training and assessment fee is paid by the Government of India. Candidates receive official NSDC certificates and monetary rewards upon successful certification.`,
        officialPortalUrl: "https://www.pmkvyofficial.org",
        tags: ["Skill Training", "Youth", "Employment", "NSDC", "Free Course", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Post-Matric Scholarship Scheme for SC/ST/OBC Students",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        applicableState: "ALL",
        issuingAuthority: "Ministry of Social Justice and Empowerment",
        eligibilityRules: {
            minAge: 16,
            maxAge: 35,
            genders: ["ALL"],
            castes: ["sc", "st", "obc"],
            religions: ["ALL"],
            occupations: ["student"],
            maxAnnualIncome: "below_2.5_lakh",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Provides complete financial assistance to meritorious students belonging to Scheduled Castes, Scheduled Tribes, and Other Backward Classes studying at post-matriculation or post-secondary stages (Classes 11, 12, ITI, Diploma, Undergraduate, and Postgraduate).
Covers 100% of non-refundable tuition fees, admission fees, and maintenance allowances paid directly via DBT into the student's bank account.`,
        officialPortalUrl: "https://scholarships.gov.in",
        tags: ["Scholarship", "Higher Education", "SC/ST/OBC Welfare", "Students", "Central Govt"],
        isActive: true,
        notificationDate: new Date(),
    },

    // ─── ADDITIONAL REGIONAL & STATE SCHEMES ────────────────────────────────
    {
        title: "Bihar Student Credit Card Scheme (Bihar)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Bihar",
        applicableDistrict: "ALL",
        issuingAuthority: "Education Department, Government of Bihar",
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
        rawExtractedText: `Government of Bihar provides an education loan of up to ₹4,00,000 with state guarantee for 12th pass students pursuing higher education (B.Tech, MBBS, MBA, BA, BSc, Polytechnic).
Interest rate is 4% for male students and only 1% for female, transgender, and Divyang students. Repayment begins 1 year after course completion or after getting employment.`,
        officialPortalUrl: "https://www.7nischay-yuvaupmission.bihar.gov.in",
        tags: ["Education Loan", "Higher Education", "Bihar", "State Scheme"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Mukhyamantri Udyami Yojana (Bihar)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Bihar",
        applicableDistrict: "ALL",
        issuingAuthority: "Department of Industries, Government of Bihar",
        eligibilityRules: {
            minAge: 18,
            maxAge: 50,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["shopkeeper_msme", "unemployed", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Provides financial assistance of ₹10,00,000 for setting up new micro-industrial manufacturing and service units in Bihar.
Assistance breakdown: ₹5,00,000 is a 100% non-repayable government grant/subsidy, and remaining ₹5,00,000 is an interest-free loan (or 1% for general men) repayable in 84 easy monthly installments.`,
        officialPortalUrl: "https://udyami.bihar.gov.in",
        tags: ["Entrepreneurship", "Industrial Grant", "Bihar", "MSME", "State Scheme"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "UP Yuva Swarozgar Yojana (Uttar Pradesh)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Uttar Pradesh",
        applicableDistrict: "ALL",
        issuingAuthority: "Department of Micro, Small and Medium Enterprises, Government of Uttar Pradesh",
        eligibilityRules: {
            minAge: 18,
            maxAge: 40,
            genders: ["ALL"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["shopkeeper_msme", "unemployed", "ALL"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Uttar Pradesh Government scheme providing financial loans up to ₹25 Lakh for industrial manufacturing sector and up to ₹10 Lakh for service sector enterprises to educated unemployed youth.
Government provides 25% margin money subsidy (up to ₹6.25 Lakh for industry and ₹2.50 Lakh for service sector) which becomes a grant after successful operation of unit for 2 years.`,
        officialPortalUrl: "https://diupmsme.upsdc.gov.in",
        tags: ["Youth Employment", "Startup Subsidy", "Uttar Pradesh", "State Scheme"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "Pudhumai Penn Scheme (Moovalur Ramamirtham Ammaiyar Scheme - Tamil Nadu)",
        documentType: DOCUMENT_TYPES.WELFARE_POLICY,
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        applicableState: "Tamil Nadu",
        applicableDistrict: "ALL",
        issuingAuthority: "Social Welfare and Women Empowerment Department, Government of Tamil Nadu",
        eligibilityRules: {
            minAge: 17,
            maxAge: 25,
            genders: ["female"],
            castes: ["ALL"],
            religions: ["ALL"],
            occupations: ["student"],
            maxAnnualIncome: "any",
            requiresRationCard: false,
            requiresDisabilityStatus: false,
        },
        rawExtractedText: `Provides monthly financial assistance of ₹1,000 directly into the bank accounts of girl students who studied from Class 6 to 12 in Government schools across Tamil Nadu until they complete their undergraduate degree, diploma, ITI, or professional course without interruption.`,
        officialPortalUrl: "https://www.pudhumaipenn.tn.gov.in",
        tags: ["Girl Child Higher Education", "Monthly Grant", "Tamil Nadu", "State Scheme"],
        isActive: true,
        notificationDate: new Date(),
    },

    // ─── ADDITIONAL MUNICIPAL CIRCULARS ─────────────────────────────────────
    {
        title: "Greater Chennai Corporation Solid Waste By-Laws & Fine Notice (Chennai)",
        documentType: DOCUMENT_TYPES.CIRCULAR,
        jurisdictionLevel: JURISDICTION_LEVELS.MUNICIPAL,
        applicableState: "Tamil Nadu",
        applicableDistrict: "Chennai",
        issuingAuthority: "Greater Chennai Corporation (GCC), Solid Waste Management Department",
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
        rawExtractedText: `Public Notice by Greater Chennai Corporation under Solid Waste Management By-laws 2019.
All bulk waste generators, commercial complexes, and retail stores in Chennai municipal limits must segregate waste into biodegradable, non-biodegradable, and domestic hazardous waste. Littering and failure to segregate attracts on-the-spot compounding penalties: ₹100 for residential, ₹1,000 for small commercial establishments, and ₹5,000 for bulk generators.`,
        officialPortalUrl: "https://chennaicorporation.gov.in",
        tags: ["Municipal Order", "Sanitation", "Solid Waste", "Chennai Corporation"],
        isActive: true,
        notificationDate: new Date(),
    },
    {
        title: "BBMP Automated E-Khata Transfer & Online Property Tax Order (Bengaluru)",
        documentType: DOCUMENT_TYPES.CIRCULAR,
        jurisdictionLevel: JURISDICTION_LEVELS.MUNICIPAL,
        applicableState: "Karnataka",
        applicableDistrict: "Bengaluru",
        issuingAuthority: "Bruhat Bengaluru Mahanagara Palike (BBMP), Revenue Department",
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
        rawExtractedText: `Notification by Bruhat Bengaluru Mahanagara Palike (BBMP) Revenue Department.
Property owners in all 198 wards of BBMP are mandated to obtain digitized GPS-tagged Final E-Khata certificates through the online portal. Property tax payments made via the online portal within the first 30 days of the financial year receive a 5% rebate. Manual receipt payments are discontinued.`,
        officialPortalUrl: "https://bbmptax.karnataka.gov.in",
        tags: ["Municipal Law", "E-Khata", "Property Tax", "BBMP Bengaluru"],
        isActive: true,
        notificationDate: new Date(),
    },
];

export async function seedFullGovCatalog() {
    await connectDB();
    console.log(`🏛️ [Full Catalog Ingestion] Ingesting ${comprehensiveGovSchemes.length} verified Government Schemes...`);

    let count = 0;
    for (const scheme of comprehensiveGovSchemes) {
        const doc = await Document.findOneAndUpdate(
            { title: scheme.title },
            { $set: scheme },
            { upsert: true, new: true }
        );
        console.log(` ✅ [${doc.jurisdictionLevel.toUpperCase()} - ${doc.applicableState}] ${doc.title}`);

        // Vector index for Civic Assistant RAG
        try {
            await indexingService.indexDocument(doc._id);
        } catch (e) {
            console.warn(`    ⚠️ Index note for ${doc.title}:`, e.message);
        }
        count++;
    }

    const totalInDb = await Document.countDocuments({ isActive: true });
    console.log(`\n🎉 [Ingestion Complete] Ingested ${count} schemes. Total active schemes in database: ${totalInDb}!`);
}

if (process.argv[1]?.endsWith("seedFullGovCatalog.js")) {
    seedFullGovCatalog()
        .then(() => {
            console.log("🔒 Seeding complete.");
            process.exit(0);
        })
        .catch((err) => {
            console.error("❌ Seeding failed:", err);
            process.exit(1);
        });
}
