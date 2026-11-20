// Hand-written stand-in for Claude's output, in the exact wire format from recommend_prompt.md.
// Numbers are taken from the mock data/snapshot.json. Phase 3 replaces this with the live route.
import type { RawRecommendations } from "./ontology";

export const MOCK_RECOMMENDATIONS: RawRecommendations = {
  briefing: [
    "Jaren Jackson Jr. went from active to day-to-day since yesterday; check his status before Wednesday's game.",
    "Dejounte Murray's slump deepened: 12.6 points over the last 7 days against 17.1 on the season.",
    "Naz Reid is the best add on the wire, up to 18.1 points over the last week with blocks and threes.",
    "Sabonis stays out until Dec 2; keep him on IR and don't use a drop on him.",
  ],
  lineup: [
    {
      player_id: 4000100,
      action: "START",
      reason: "Your engine for assists, and he's trending up over the last week.",
      factors: [
        { label: "Games", value: "3", direction: "neutral" },
        { label: "AST L15", value: "10.2", direction: "up" },
        { label: "PTS L7", value: "21.1 vs 19.5", direction: "up" },
      ],
      confidence: "high",
    },
    {
      player_id: 4000107,
      action: "START",
      reason: "Four games and the hottest scorer on your roster this week.",
      factors: [
        { label: "Games", value: "4", direction: "up" },
        { label: "PTS L7", value: "21.8 vs 19.8", direction: "up" },
        { label: "MIN L7", value: "34.4", direction: "up" },
      ],
      confidence: "high",
    },
    {
      player_id: 4000114,
      action: "START",
      reason: "Scoring has dipped, but four games and heavy minutes still make him a starter.",
      factors: [
        { label: "Games", value: "4", direction: "up" },
        { label: "PTS L7", value: "15.1 vs 18.3", direction: "down" },
        { label: "MIN L7", value: "34.2", direction: "neutral" },
      ],
      confidence: "medium",
    },
    {
      player_id: 4000121,
      action: "MONITOR",
      reason: "Newly day-to-day; start him if he's cleared before Wednesday's game, otherwise slide Suggs in.",
      factors: [
        { label: "Status", value: "Day-to-day", direction: "down" },
        { label: "BLK L15", value: "1.8", direction: "up" },
        { label: "Games", value: "3", direction: "neutral" },
      ],
      confidence: "medium",
    },
    {
      player_id: 4000128,
      action: "START",
      reason: "A rebounds and assists anchor at center, playing more minutes lately.",
      factors: [
        { label: "REB L15", value: "10.7", direction: "up" },
        { label: "AST L15", value: "5.5", direction: "up" },
        { label: "TO L15", value: "3.2", direction: "down" },
      ],
      confidence: "high",
    },
    {
      player_id: 4000135,
      action: "START",
      reason: "Steady across every window, with four games on the slate.",
      factors: [
        { label: "Games", value: "4", direction: "up" },
        { label: "PTS L7", value: "21.9 vs 21.7", direction: "neutral" },
        { label: "STL L15", value: "1.5", direction: "up" },
      ],
      confidence: "high",
    },
    {
      player_id: 4000142,
      action: "START",
      reason: "Only two games this week, but his category spread is too good to bench.",
      factors: [
        { label: "Games", value: "2", direction: "down" },
        { label: "REB L15", value: "8.0", direction: "up" },
        { label: "AST L15", value: "5.8", direction: "up" },
      ],
      confidence: "medium",
    },
    {
      player_id: 4000149,
      action: "START",
      reason: "Four games, and he's shooting his way up: threes and blocks from a guard.",
      factors: [
        { label: "Games", value: "4", direction: "up" },
        { label: "PTS L7", value: "19.0 vs 15.8", direction: "up" },
        { label: "3PM L15", value: "3.5", direction: "up" },
      ],
      confidence: "high",
    },
    {
      player_id: 4000156,
      action: "START",
      reason: "Four games of efficient rebounding; nothing on the bench beats it.",
      factors: [
        { label: "Games", value: "4", direction: "up" },
        { label: "FG% L15", value: ".684", direction: "up" },
        { label: "REB L15", value: "10.6", direction: "up" },
      ],
      confidence: "medium",
    },
    {
      player_id: 4000163,
      action: "SIT",
      reason: "In a deep slump with fewer minutes; Suggs has more games and steadier production.",
      factors: [
        { label: "PTS L7", value: "12.6 vs 17.1", direction: "down" },
        { label: "MIN L7", value: "28.0 vs 31.2", direction: "down" },
        { label: "FG% L15", value: ".429", direction: "down" },
      ],
      confidence: "high",
    },
    {
      player_id: 4000170,
      action: "START",
      reason: "Moves up from the bench into Murray's slot: four games and steals.",
      factors: [
        { label: "Games", value: "4", direction: "up" },
        { label: "STL L15", value: "1.5", direction: "up" },
        { label: "FG% L15", value: ".417", direction: "down" },
      ],
      confidence: "medium",
    },
    {
      player_id: 4000177,
      action: "SIT",
      reason: "Four games, but his scoring and minutes are both sliding; he's the first drop candidate.",
      factors: [
        { label: "PTS L7", value: "11.5 vs 14.0", direction: "down" },
        { label: "MIN L7", value: "29.9 vs 32.5", direction: "down" },
        { label: "Games", value: "4", direction: "up" },
      ],
      confidence: "medium",
    },
    {
      player_id: 4000184,
      action: "SIT",
      reason: "Out until Dec 2; he stays on IR and doesn't cost you a roster spot.",
      factors: [
        { label: "Status", value: "Out", direction: "down" },
        { label: "Return", value: "Dec 2", direction: "neutral" },
      ],
      confidence: "high",
    },
  ],
  pickups: [
    {
      add_player_id: 4200300,
      drop_player_id: 4000177,
      reason: "Reid is surging with blocks and threes while Keegan Murray fades; three games against four, but better per game.",
      factors: [
        { label: "PTS L7", value: "18.1 vs 11.5", direction: "up" },
        { label: "BLK L15", value: "1.2 vs 0.6", direction: "up" },
        { label: "Games", value: "3 vs 4", direction: "down" },
      ],
      confidence: "medium",
    },
    {
      add_player_id: 4200311,
      drop_player_id: 4000163,
      reason: "Thompson's steals, blocks and efficiency beat Murray's slump, but you'd be selling low on a 17-point scorer.",
      factors: [
        { label: "STL+BLK L15", value: "3.5 vs 1.4", direction: "up" },
        { label: "Games", value: "4 vs 3", direction: "up" },
        { label: "PTS season", value: "11.5 vs 17.1", direction: "down" },
      ],
      confidence: "low",
    },
  ],
};
