import type { UserProfile } from "../types/auth.ts";

/**
 * Generates a localized prompt for the AI Civic Assistant (NagrikMitra)
 * to explain a government scheme in the citizen's preferred language.
 *
 * @param schemeTitle - Clean standardized name of the scheme or policy
 * @param language - Active BCP-47 / ISO-639-1 language code (e.g. 'hi', 'en', 'gu', 'mr')
 * @returns Ready-to-submit vernacular prompt
 */
export const buildSchemeExplanationPrompt = (schemeTitle: string, language: string): string => {
  const cleanTitle = schemeTitle.trim();

  switch (language) {
    case "hi":
      return `कृपया मुझे '${cleanTitle}' योजना के बारे में विस्तार से और सरल भाषा में समझाएं — इसके क्या-क्या लाभ हैं, कौन इसके लिए पात्र है, और आवेदन करने की पूरी प्रक्रिया क्या है?`;
    case "gu":
      return `કૃપા કરીને મને '${cleanTitle}' યોજના વિશે સરળ ભાષામાં વિગતવાર સમજાવો — તેના ફાયદા શું છે, કોણ પાત્ર છે અને અરજી કેવી રીતે કરવી?`;
    case "mr":
      return `कृपया मला '${cleanTitle}' योजनेबद्दल सोप्या भाषेत सविस्तर माहिती द्या — याचे काय फायदे आहेत, कोण पात्र आहे आणि अर्ज कसा करावा?`;
    case "bn":
      return `দয়া করে আমাকে '${cleanTitle}' প্রকল্প সম্পর্কে সহজ ভাষায় বিস্তারিত জানান — এর কী কী सुविधा রয়েছে, কারা যোগ্য এবং কীভাবে আবেদন করতে হবে?`;
    case "ta":
      return `தயவுசெய்து '${cleanTitle}' திட்டம் பற்றி எளிய மொழியில் விளக்குங்கள் — இதன் பலன்கள் என்ன, யார் தகுதியானவர்கள் மற்றும் எப்படி விண்ணப்பிப்பது?`;
    case "te":
      return `దయచేసి '${cleanTitle}' పథకం గురించి సులభమైన భాషలో వివరించండి — దీని ప్రయోజనాలు ఏమిటి, ఎవరు అర్హులు మరియు ఎలా దరఖాస్తు చేయాలి?`;
    case "kn":
      return `ದಯವಿಟ್ಟು ನನಗೆ '${cleanTitle}' ಯೋಜನೆಯ ಬಗ್ಗೆ ಸರಳ ಭಾಷೆಯಲ್ಲಿ ವಿವರವಾಗಿ ತಿಳಿಸಿ — ಇದರ ಪ್ರಯೋಜನಗಳೇನು, ಯಾರು ಅರ್ಹರು ಮತ್ತು ಹೇಗೆ ಅರ್ಜಿ ಸಲ್ಲಿಸುವುದು?`;
    default:
      return `Please explain the '${cleanTitle}' scheme in simple citizen-friendly terms: What are its key benefits, who is eligible to apply, and what is the step-by-step application process?`;
  }
};

/**
 * Builds an intelligent, profile-aware eligibility preprompt for Civic Assistant.
 * Incorporates state, age, occupation, income, caste, disability, and ration card details.
 */
export const buildEligibilityCheckPrompt = (
  profile: UserProfile | null,
  language: string = "en"
): string => {
  const isHi = language === "hi";

  if (!profile) {
    if (isHi) {
      return `नमस्ते नागरिक-सेतु AI! मैं केंद्र और राज्य सरकार की कल्याणकारी योजनाओं (जैसे कृषि, स्वास्थ्य, महिला सशक्तिकरण, एमएसएमई व व्यापार ऋण, पेंशन, छात्रवृत्ति) में अपनी पात्रता जानना चाहता हूँ। कृपया मुझे बताएं कि मेरी स्थिति के अनुसार कौन-सी मुख्य योजनाएं उपलब्ध हैं और पात्रता की जांच के लिए मुझे क्या-क्या विवरण चाहिए?`;
    }
    return `Hello Lok-Setu AI! I would like to check my eligibility for government welfare schemes (including agriculture, health insurance, women empowerment, MSME/business credit, pensions, and scholarships). Please guide me on which key central and state schemes are available and what details I should provide to determine my eligibility.`;
  }

  const stateStr = profile.state || "India (Central)";
  const cityStr = profile.city ? `, ${profile.city}` : "";
  const ageStr = profile.age ? `${profile.age}` : "Not specified";
  const genderStr = profile.gender ? profile.gender.toUpperCase() : "Not specified";
  const occStr = profile.occupation
    ? profile.occupation.replace(/_/g, " ").toUpperCase()
    : profile.isFarmer
    ? "FARMER"
    : profile.isBusinessOwner
    ? "BUSINESS OWNER / MSME"
    : "Not specified";
  const incomeStr = profile.incomeRange
    ? profile.incomeRange.replace(/_/g, " ")
    : "Not specified";
  const casteStr = profile.caste ? profile.caste.toUpperCase() : "GENERAL";
  const rationStr = profile.rationCardType
    ? profile.rationCardType.replace(/_/g, " ").toUpperCase()
    : "None / Not specified";
  const disabilityStr = profile.isSpeciallyAbled ? "Yes (दिव्यांग / PwD)" : "No";

  if (isHi) {
    return `नमस्ते नागरिक-सेतु AI! मेरी व्यक्तिगत व जनसांख्यिकीय जानकारी के अनुसार मेरे लिए पात्र सरकारी योजनाओं (केंद्र व राज्य सरकार) की पहचान करें:
• राज्य व जिला: ${stateStr}${cityStr}
• उम्र: ${ageStr} वर्ष | लिंग: ${genderStr}
• व्यवसाय / आजीविका: ${occStr}
• पारिवारिक वार्षिक आय: ${incomeStr}
• सामाजिक श्रेणी: ${casteStr}
• राशन कार्ड: ${rationStr}
• दिव्यांगता स्थिति: ${disabilityStr}

कृपया मेरे लिए सबसे उपयुक्त और लाभकारी योजनाओं की सूची दें और प्रत्येक के लिए विस्तार से बताएं:
1. मुख्य वित्तीय व सामाजिक लाभ (सब्सिडी, DBT राशि, ब्याज छूट, ऋण)
2. जरूरी दस्तावेज चेकलिस्ट (Aadhaar, Passbook, प्रमाण पत्र)
3. आवेदन कैसे और कहाँ करना है (Portal / नजदीकी केंद्र)
4. कोई मुख्य अपात्रता शर्तें
कृपया सरल व व्यावहारिक हिंदी में पूर्ण विवरण दें।`;
  }

  return `Hello Lok-Setu AI! Based on my demographic profile, please evaluate and recommend all eligible central and state government welfare schemes for me:
• State & Location: ${stateStr}${cityStr}
• Age: ${ageStr} years | Gender: ${genderStr}
• Occupation / Livelihood: ${occStr}
• Annual Household Income: ${incomeStr}
• Social Category / Caste: ${casteStr}
• Ration Card Category: ${rationStr}
• Specially Abled / Disability Status: ${disabilityStr}

Please suggest all relevant schemes I qualify for with a detailed breakdown of:
1. Direct Financial & Livelihood Entitlements (DBT amounts, subsidies, loan caps, insurance)
2. Required Verification Documents Checklist
3. Step-by-Step Application Workflow (official portal & CSC/offline steps)
4. Key Exclusions or Disqualifications
Please provide a comprehensive, citizen-friendly explanation.`;
};
