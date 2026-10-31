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
      return `দয়া করে আমাকে '${cleanTitle}' প্রকল্প সম্পর্কে সহজ ভাষায় বিস্তারিত জানান — এর কী কী সুবিধা রয়েছে, কারা যোগ্য এবং কীভাবে আবেদন করতে হবে?`;
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

