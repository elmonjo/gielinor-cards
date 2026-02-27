import { skillCardsData } from "./data/skills";
import { gearCardsData } from "./data/gear";
import { bossCardsData } from "./data/bosses";
import { minigameCardsData } from "./data/minigames";
import { questCardsData } from "./data/quests";
import { diaryCardsData } from "./data/diaries";
import { miscCardsData } from "./data/misc";

export const cards = [
  ...skillCardsData,
  ...gearCardsData,
  ...bossCardsData,
  ...minigameCardsData,
  ...questCardsData,
  ...diaryCardsData,
  ...miscCardsData
];
