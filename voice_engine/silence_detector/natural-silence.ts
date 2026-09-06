export type SilencePrompt = { text: string; language: string };

const prompts: Record<string, string[]> = {
  ar: ["هل ما زلت هناك؟", "خذ وقتك، أنا أستمع.", "هل تريد المتابعة؟"],
  bn: ["আপনি কি এখনও আছেন?", "সময় নিন, আমি শুনছি।", "আপনি কি চালিয়ে যেতে চান?"],
  ca: ["Encara hi ets?", "Pren-te el teu temps, t'escolto.", "Volies continuar?"],
  zh: ["你还在吗？", "慢慢来，我在听。", "你想继续吗？"],
  cs: ["Jste tam ještě?", "Dejte si načas, poslouchám.", "Chcete pokračovat?"],
  da: ["Er du der stadig?", "Tag dig bare god tid, jeg lytter.", "Vil du fortsætte?"],
  nl: ["Ben je er nog?", "Neem gerust de tijd, ik luister.", "Wil je doorgaan?"],
  en: ["Are you still there?", "Take your time, I'm listening.", "Did you want to continue?"],
  fi: ["Oletko vielä siellä?", "Ota rauhassa, kuuntelen.", "Haluatko jatkaa?"],
  fr: ["Tu es toujours là ?", "Prends ton temps, je t’écoute.", "Tu voulais continuer ?"],
  de: ["Bist du noch da?", "Lass dir Zeit, ich höre zu.", "Möchtest du weitermachen?"],
  el: ["Είσαι ακόμα εκεί;", "Πάρε τον χρόνο σου, σε ακούω.", "Θέλεις να συνεχίσεις;"],
  he: ["אתה עדיין שם?", "קח את הזמן, אני מקשיב.", "רצית להמשיך?"],
  hi: ["क्या आप अभी भी वहाँ हैं?", "आराम से, मैं सुन रहा हूँ।", "क्या आप आगे जारी रखना चाहते हैं?"],
  hu: ["Még ott vagy?", "Csak nyugodtan, figyelek.", "Szeretnéd folytatni?"],
  id: ["Kamu masih di sana?", "Santai saja, aku mendengarkan.", "Kamu ingin melanjutkan?"],
  it: ["Ci sei ancora?", "Prenditi pure il tuo tempo, ti ascolto.", "Volevi continuare?"],
  ja: ["まだそこにいますか？", "ゆっくりで大丈夫です。聞いています。", "続けますか？"],
  ko: ["아직 계신가요?", "천천히 하세요. 듣고 있어요.", "계속하시겠어요?"],
  ms: ["Awak masih di sana?", "Ambil masa, saya sedang mendengar.", "Awak mahu teruskan?"],
  no: ["Er du der fortsatt?", "Ta den tiden du trenger, jeg lytter.", "Vil du fortsette?"],
  fa: ["هنوز آنجایی؟", "عجله نکن، گوش می‌دهم.", "می‌خواهی ادامه بدهی؟"],
  pl: ["Jesteś tam jeszcze?", "Nie spiesz się, słucham.", "Chcesz kontynuować?"],
  pt: ["Você ainda está aí?", "Sem pressa, estou ouvindo.", "Você queria continuar?"],
  ro: ["Mai ești acolo?", "Nu te grăbi, te ascult.", "Vrei să continui?"],
  ru: ["Ты ещё здесь?", "Не спеши, я слушаю.", "Хочешь продолжить?"],
  es: ["¿Sigues ahí?", "Tómate tu tiempo, te escucho.", "¿Querías continuar?"],
  sw: ["Bado upo?", "Chukua muda wako, ninasikiliza.", "Ungependa kuendelea?"],
  sv: ["Är du kvar?", "Ta den tid du behöver, jag lyssnar.", "Vill du fortsätta?"],
  tl: ["Nariyan ka pa ba?", "Dahan-dahan lang, nakikinig ako.", "Gusto mo bang magpatuloy?"],
  ta: ["நீங்கள் இன்னும் இருக்கிறீர்களா?", "நிதானமாக இருங்கள், நான் கேட்கிறேன்.", "தொடர விரும்புகிறீர்களா?"],
  th: ["ยังอยู่ไหม?", "ค่อย ๆ คิดได้ ฉันกำลังฟังอยู่", "อยากคุยต่อไหม?"],
  tr: ["Hâlâ orada mısın?", "Acele etme, dinliyorum.", "Devam etmek ister misin?"],
  uk: ["Ти ще тут?", "Не поспішай, я слухаю.", "Хочеш продовжити?"],
  ur: ["کیا آپ ابھی بھی وہاں ہیں؟", "آرام سے، میں سن رہا ہوں۔", "کیا آپ جاری رکھنا چاہتے ہیں؟"],
  vi: ["Bạn vẫn ở đó chứ?", "Cứ từ từ, tôi đang lắng nghe.", "Bạn có muốn tiếp tục không?"],
};

function randomUnit(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] / 0xffffffff;
  }
  return Math.random();
}

export class NaturalSilenceDetector {
  private timer = 0;
  private reminder = 0;
  private running = false;
  private suspended = false;

  constructor(
    private readonly language: string,
    private readonly onPrompt: (prompt: SilencePrompt) => void | Promise<void>,
  ) {}

  start(): void {
    this.running = true;
    this.reminder = 0;
    this.schedule();
  }

  activity(): void {
    if (!this.running) return;
    this.reminder = 0;
    this.schedule();
  }

  setSuspended(value: boolean): void {
    this.suspended = value;
    if (value && this.timer) window.clearTimeout(this.timer);
    else if (this.running) this.schedule();
  }

  private schedule(): void {
    if (this.timer) window.clearTimeout(this.timer);
    if (!this.running || this.suspended) return;
    const base = this.reminder === 0 ? 18_500 : 34_000;
    const spread = this.reminder === 0 ? 4_000 : 8_000;
    this.timer = window.setTimeout(() => void this.fire(), base + randomUnit() * spread);
  }

  private async fire(): Promise<void> {
    if (!this.running || this.suspended) return;
    const requested = this.language.toLowerCase().split("-")[0];
    const language = prompts[requested] ? requested : "en";
    const options = prompts[language];
    const index = (this.reminder + Math.floor(randomUnit() * options.length)) % options.length;
    this.reminder += 1;
    await this.onPrompt({ text: options[index], language });
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = 0;
  }
}
