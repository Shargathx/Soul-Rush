// The playtest questionnaire as data. tools/docs/form_script.js turns it into docs/playtest-form.gs, a Google Apps Script that builds the
// real Google Form (scales, multiple choice, tick boxes, grids, text) in one run. Edit the questions here, not in the .gs file.
//
// Question kinds:
//   scale(text, lowLabel, highLabel)   a 1 to 5 scale
//   choice(text, [options], {other})   pick one (other: add an "Other" box)
//   multi(text, [options], {other})    tick all that apply
//   short(text)  /  long(text)         a line of text / a paragraph
//   grid(text, [rows], lowLabel, highLabel)  rows of 1 to 5 ratings
const scale = (text, low, high) => ({ kind: "scale", text, low, high });
const choice = (text, options, o = {}) => ({ kind: "choice", text, options, other: !!o.other });
const multi = (text, options, o = {}) => ({ kind: "multi", text, options, other: !!o.other });
const short = text => ({ kind: "short", text });
const long = text => ({ kind: "long", text });
const grid = (text, rows, low, high) => ({ kind: "grid", text, rows, low, high });

const TUTORIAL_TOPICS = ["Moving and rolling", "Attacking", "Deflecting", "The posture bar", "The deathblow", "Lives and the curse"];
const SOUND_BOSS = ["Fun", "Fair", "Readable (could I see what was coming?)"];

module.exports = {
  title: "Soul Rush: playtest feedback",
  description: "Thanks for playing Soul Rush, a boss-rush action game about deflects and posture: break a boss's posture, then land the deathblow.\n\nThere are no right or wrong answers. \"This felt unfair\" or \"I did not understand this\" is exactly what I need to hear. Answer from what you felt, skip anything you like, and it takes about 10 minutes. If you are short on time, the questions marked (quick) are enough.",
  confirmation: "Thank you! Your answers are in. If you remember anything else later, you can fill the form in again.",
  sections: [
    { title: "About you and the build", help: "", questions: [
      short("Your name or nickname (optional)"),
      short("Which version or build did you play? (the developer will tell you, or leave it empty)"),
      choice("How often do you play action games with dodges or blocks (Souls-likes, Sekiro, Hades, Hollow Knight)?", ["Never", "A little", "Regularly", "A lot"]),
      choice("Have you played a game built around deflecting or parrying (Sekiro, Nioh, Hi-Fi Rush)?", ["Yes", "No"]),
      choice("What did you play with?", ["Keyboard", "Controller", "Both"]),
      choice("Which browser?", ["Chrome", "Edge", "Firefox", "Safari"], { other: true }),
      choice("How long did you play?", ["Under 15 minutes", "15 to 30 minutes", "30 to 60 minutes", "Over an hour"]),
      multi("Which fights did you reach?", ["The tutorial", "Samurai phase 1", "Samurai phase 2", "Samurai phase 3", "Leaf Ranger", "Gunslinger", "I beat at least one boss"]),
    ] },
    { title: "First impression and the tutorial", help: "", questions: [
      scale("After the tutorial, did you know what to do in the first fight?", "No idea", "Completely"),
      multi("Which of these did the tutorial teach clearly?", TUTORIAL_TOPICS),
      multi("Which of these was still unclear after the tutorial?", TUTORIAL_TOPICS),
      choice("Was the tutorial...", ["Too long", "About right", "Too short"]),
      long("Did any prompt or instruction confuse you? Which one?"),
    ] },
    { title: "Controls and mechanics", help: "Rate how each felt. 1 = bad, 5 = great.", questions: [
      grid("How did each of these feel?", ["Movement (walking and running)", "Attack (the sword combo)", "Roll (the dodge and its invulnerability)", "Deflect (raising the sword just as a hit lands)", "Lunge (Q, the stamina-costing dash attack)", "Deathblow (F on a posture-broken boss)"], "Bad", "Great"),
      long("For anything you rated 1 or 2: what was wrong with it?"),
      choice("Stamina: attacks, rolls and lunges all cost stamina. Which is closest?", ["I almost never ran out", "I sometimes ran out and it felt right", "I ran out too often and it felt unfair", "I did not notice stamina"]),
      choice("Directional deflect: a deflect only works if you face the attack. How did that feel?", ["Natural", "Fine once I got used to it", "Confusing", "Frustrating"]),
      choice("The deflect timing window is short. Was it...", ["Too generous", "About right", "A bit too tight", "Far too tight"]),
      long("Did the controls ever do something you did not intend (an attack when you wanted a roll, a deflect that did not come out)? Describe it."),
      long("Is there a move or key you never used? Which one, and why?"),
    ] },
    { title: "Does the game feel fluid?", help: "", questions: [
      scale("Overall, how responsive were the controls? (quick)", "Sluggish", "Immediate"),
      choice("Was there a delay between pressing a key and the character reacting?", ["Never", "Sometimes", "Often", "Always"]),
      choice("How was the frame rate? (quick)", ["Smooth throughout", "Mostly smooth with some drops", "Often choppy", "Unplayable"]),
      multi("When did it stutter?", ["Loading a scene", "During a boss fight", "On specific attacks or effects", "Around the hub", "It did not stutter"]),
      choice("Did the sounds line up with what you saw (hit, deflect, attack)? (quick)", ["Yes", "Mostly", "Sounds came late", "Sounds were missing"]),
      choice("The hit-stop and screen shake when you hit or deflect...", ["Felt good", "Were too much", "Were too little", "I did not notice"]),
      long("Anything that felt stiff, floaty, slow to recover or sticky?"),
    ] },
    { title: "Difficulty and fairness", help: "", questions: [
      scale("Overall difficulty (quick)", "Far too easy", "Far too hard"),
      scale("How fair did the game feel? (quick)", "It often felt cheap", "Every death was my fault"),
      choice("When you died, was it usually...", ["I made a mistake and knew it", "I did not understand what killed me", "It felt unavoidable", "A bug"]),
      scale("Could you read enemy attacks before they hit? (quick)", "No", "Always"),
      long("Which attack was hardest to read? Tell us the boss and what it looked like."),
      long("Did any attack feel impossible to deflect or dodge? Which?"),
      choice("Damage: hits do real damage and also build your posture bar. Were hits...", ["Too weak", "About right", "Too punishing"]),
      choice("Lives and curse: each death costs max HP until you land a deathblow. It felt...", ["Motivating", "Neutral", "Too harsh", "Confusing"]),
      choice("Rally: hitting a boss soon after being hurt gives some health back. Did you notice it?", ["Yes and I used it", "Yes but it did not matter", "No"]),
      long("Did any fight feel too long? Which one, and at what point?"),
      long("Did any fight feel too easy? Which one?"),
    ] },
    { title: "Posture and the deathblow", help: "", questions: [
      scale("Did you understand what the boss's posture bar does?", "Not at all", "Fully"),
      multi("How did you break a boss's posture most of the time?", ["Deflecting his attacks", "Hitting him with the sword", "Both", "I could not break it"]),
      choice("How did breaking posture feel?", ["Satisfying and earned", "Too easy", "Too slow", "Impossible to keep up"]),
      long("Did you understand your own posture bar (under the arena)? When it filled, did you know why?"),
      choice("The stun when your own posture broke (about 2 seconds)...", ["Was fair", "Was too long", "Was too short", "Never happened to me"]),
      choice("Landing the deathblow was...", ["Satisfying", "Too easy", "Too hard to reach", "I never landed one"]),
    ] },
    { title: "The Samurai", help: "Skip this page if you did not fight him.", questions: [
      grid("The Samurai overall", SOUND_BOSS, "1 (bad)", "5 (great)"),
      grid("Difficulty of each phase", ["Phase 1 (plain swings)", "Phase 2 (he switches sides each attack)", "Phase 3 (faster, with afterimages)"], "Easy", "Hard"),
      choice("The afterimages that appear after a dodge, dash strike or wall slash and attack on their own:", ["Cool and readable", "Cool but confusing", "Too many at once", "I did not notice them"]),
      choice("In phase 3 you have to face the image, not him, to deflect its attack. Did you work that out?", ["Yes, right away", "After a while", "No"]),
      choice("The Samurai dodges some of your attacks. This...", ["Was fine, it keeps him alive", "Happened too often", "Happened too rarely", "Made him feel untouchable"]),
      choice("The grab (he reaches for you and it cannot be deflected) was...", ["Fair", "Too hard to avoid", "Too easy to avoid", "I never saw it"]),
      scale("The red glints (eye glint before a dash, sheath glint before the wall slash): did they warn you in time?", "Not at all", "Always"),
      long("Petals, the tornado, the Judgement Cut: which was hardest, and which was your favorite?"),
      long("Anything in his pattern that felt random, even though his timings are meant to be fixed and learnable?"),
    ] },
    { title: "The Leaf Ranger", help: "Skip this page if you did not fight him.", questions: [
      grid("The Leaf Ranger overall", SOUND_BOSS, "1 (bad)", "5 (great)"),
      scale("Could you get close enough to hit him?", "Never", "Easily"),
      choice("Posture on him: did it ever feel like you were making progress toward a break?", ["Yes, clearly", "Sometimes", "No, it never moved"]),
      choice("The sniper perch (he leaps up and fires arrows, and only a deflected laser brings him down) was...", ["Clear and fun", "Confusing", "Too hard", "I never got there"]),
      multi("Which of his moves were hardest?", ["Shots", "Rain", "Snares", "Thorn wall", "Bramble grasp", "The beam", "Air volley"]),
    ] },
    { title: "The Gunslinger", help: "Skip this page if you did not fight him.", questions: [
      grid("The Gunslinger overall", SOUND_BOSS, "1 (bad)", "5 (great)"),
      long("Anything unfinished, unclear or unfair about this fight?"),
    ] },
    { title: "The hub and presentation", help: "", questions: [
      scale("Was it clear where to go in the hub and how to start a fight?", "Not at all", "Very clear"),
      choice("The keeper's training question (yes or no) was...", ["Helpful", "Annoying", "I did not notice it"]),
      scale("How well could you read the screen in the middle of a fight?", "A mess", "Clear"),
      long("Were there effects, backgrounds or particles that were distracting or hid an attack?"),
      grid("Audio", ["Music", "Sound effects"], "Bad", "Great"),
      long("Anything too loud, too quiet or repetitive in the audio?"),
      choice("Did the sword clashes and deflects sound satisfying?", ["Yes", "They were OK", "No"]),
      long("Could you always read your HP, stamina and posture, and the boss's HP and posture? Anything hard to see?"),
    ] },
    { title: "Overall", help: "", questions: [
      scale("Would you keep playing this game? (quick)", "No", "Definitely"),
      choice("Would you recommend it to a friend who likes challenging action games?", ["Yes", "Maybe", "No"]),
      long("What was the best moment? (quick)"),
      long("What was the most frustrating moment? (quick)"),
      long("If you could change one thing, what would it be? (quick)"),
      long("Bugs: anything broken, stuck or glitchy? Where, and what were you doing? (Say if you can send a screenshot or a recording.)"),
      long("Anything else?"),
    ] },
  ],
};
