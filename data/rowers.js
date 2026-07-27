// Rower data - edit this file directly to add/update rowers.
const ROWERS_DATA = [
  {
    "name": "Samuel Peale",
    "year": 2025,
    "2k": "06:28.9",
    "weight": 162.4,
    "port": 4.5,
    "starboard": 4.7,
    "mentality": 4.3,
    "rarity": "Generational"
  },
  {
    "name": "Gunnar Westland",
    "year": 2025,
    "2k": "06:31.9",
    "weight": 166.8,
    "port": 3.9,
    "starboard": 4.1,
    "mentality": 4.4,
    "rarity": "Freak",
    "individualAwards": [
      { "year": 2025, "award": "Honorable Mention" },
      { "year": 2024, "award": "Honorable Mention" },
      { "year": 2025, "award": "Hammer" }
    ]
  },
  {
    "name": "Carson Fast",
    "year": 2026,
    "2k": "06:25.5",
    "weight": 173,
    "port": 4.3,
    "starboard": 3.1,
    "mentality": 4.8,
    "rarity": "Generational",
    "individualAwards": [
      { "year": 2026, "award": "First Team" },
      { "year": 2026, "award": "Hammer" }
    ],
    "captain": true
  },
  {
    "name": "Henry Terrell",
    "year": 2025,
    "2k": "06:37.2",
    "weight": 200,
    "port": 3.9,
    "starboard": 3.2,
    "mentality": 4,
    "rarity": "Pretty Good"
  },
  {
    "name": "Matthew Matar",
    "year": 2025,
    "2k": "06:38.1",
    "weight": 190.5,
    "port": 2,
    "starboard": 4.1,
    "mentality": 3.9,
    "rarity": "Pretty Good",
    "captain": true
  },
  {
    "name": "Adrian Wiklund",
    "year": 2027,
    "2k": "06:38.3",
    "weight": 188,
    "port": 3.8,
    "starboard": 2.3,
    "mentality": 4,
    "rarity": "Pretty Good",
    "individualAwards": [
      { "year": 2026, "award": "Second Team" },
      { "year": 2026, "award": "Most Valuable Player" }
    ],
    "captain": true
  },
  {
    "name": "Jack Kirk",
    "year": 2025,
    "2k": "06:39.7",
    "weight": 179.6,
    "port": 4,
    "starboard": 4.1,
    "mentality": 4.2,
    "rarity": "Pretty Good"
  },
  {
    "name": "Andrew Egorin",
    "year": 2025,
    "2k": "06:46.1",
    "weight": 148.5,
    "port": 4.2,
    "starboard": 4.3,
    "mentality": 4.9,
    "rarity": "Pretty Good"
  },
  {
    "name": "Minh Tran",
    "year": 2027,
    "2k": "06:35.6",
    "weight": 151,
    "port": 4.4,
    "starboard": 3.9,
    "mentality": 4.2,
    "rarity": "Generational",
    "individualAwards": [
      { "year": 2026, "award": "Second Team" }
    ]
  },
  {
    "name": "Julian Schatz",
    "year": 2028,
    "2k": "06:57.2",
    "weight": 151,
    "port": 3.9,
    "starboard": 2,
    "mentality": 3.7,
    "rarity": "Mid"
  },
  {
    "name": "Alex Barnes",
    "year": 2025,
    "2k": "06:57.4",
    "weight": 145,
    "port": 4.4,
    "starboard": 2.5,
    "mentality": 3.3,
    "rarity": "Noob"
  },
  {
    "name": "Danny Luo",
    "year": 2028,
    "2k": "06:58.4",
    "weight": 172,
    "port": 3.2,
    "starboard": 3,
    "mentality": 3.7,
    "rarity": "Mid"
  },
  {
    "name": "Rieden Rebugio",
    "year": 2028,
    "2k": "06:59.2",
    "weight": 159,
    "port": 3,
    "starboard": 3.3,
    "mentality": 2.7,
    "rarity": "Mid"
  },
  {
    "name": "Sean Noh",
    "year": 2027,
    "2k": "06:59.2",
    "weight": 147.8,
    "port": 3.6,
    "starboard": 2.7,
    "mentality": 4.4,
    "rarity": "Mid"
  },
  {
    "name": "Nathaniel Lee",
    "year": 2027,
    "2k": "07:06.0",
    "weight": 168,
    "port": 3,
    "starboard": 3.6,
    "mentality": 3.6,
    "rarity": "Mid"
  },
  {
    "name": "Owen Kelly",
    "year": 2027,
    "2k": "07:09.0",
    "weight": 144,
    "port": 1.9,
    "starboard": 3.6,
    "mentality": 3.7,
    "rarity": "Mid"
  },
  {
    "name": "James Millward (Rower)",
    "year": 2026,
    "2k": "07:09.6",
    "weight": 138.7,
    "port": 2.4,
    "starboard": 3.2,
    "mentality": 3.1,
    "rarity": "Noob"
  },
  {
    "name": "Alden Strubhar",
    "year": 2028,
    "2k": "07:10.0",
    "weight": 181,
    "port": 2.8,
    "starboard": 3.1,
    "mentality": 3.9,
    "rarity": "Mid"
  },
  {
    "name": "Holden Saunders",
    "year": 2026,
    "2k": "07:10.3",
    "weight": 140,
    "port": 3.9,
    "starboard": 4.1,
    "mentality": 3.9,
    "rarity": "Mid"
  },
  {
    "name": "Finnegan Switzer",
    "year": 2025,
    "2k": "07:10.6",
    "weight": 151,
    "port": 3.3,
    "starboard": 3.9,
    "mentality": 3.8,
    "rarity": "Noob"
  },
  {
    "name": "Shaheen Tahir",
    "year": 2028,
    "2k": "07:14.0",
    "weight": 153,
    "port": 3.6,
    "starboard": 2.8,
    "mentality": 3.7,
    "rarity": "Mid"
  },
  {
    "name": "Colton Nagel",
    "year": 2028,
    "2k": "07:16.8",
    "weight": 144,
    "port": 2.7,
    "starboard": 3.1,
    "mentality": 3.9,
    "rarity": "Mid"
  },
  {
    "name": "Arham Jain",
    "year": 2027,
    "2k": "07:19.2",
    "weight": 123.4,
    "port": 2.7,
    "starboard": 3.7,
    "mentality": 2.7,
    "rarity": "Noob"
  },
  {
    "name": "Ethan Hoffman",
    "year": 2028,
    "2k": "07:19.3",
    "weight": 133,
    "port": 3.5,
    "starboard": 3.5,
    "mentality": 4.4,
    "rarity": "Mid"
  },
  {
    "name": "Alex Absher",
    "year": 2028,
    "2k": "07:23.0",
    "weight": 184,
    "port": 2.5,
    "starboard": 2.6,
    "mentality": 3,
    "rarity": "Noob"
  },
  {
    "name": "Jainam Shah",
    "year": 2027,
    "2k": "07:28.8",
    "weight": 161,
    "port": 2.4,
    "starboard": 2.5,
    "mentality": 2.5,
    "rarity": "Noob"
  },
  {
    "name": "Abhay Shukla",
    "year": 2028,
    "2k": "07:29.9",
    "weight": 152,
    "port": 2.3,
    "starboard": 2.9,
    "mentality": 2.8,
    "rarity": "Noob"
  },
  {
    "name": "Theodor Nedelescu",
    "year": 2028,
    "2k": "07:33.8",
    "weight": 144,
    "port": 3.6,
    "starboard": 2.4,
    "mentality": 2.8,
    "rarity": "Noob"
  },
  {
    "name": "Mickey Bekele",
    "year": 2027,
    "2k": "07:35.6",
    "weight": 132,
    "port": 2.7,
    "starboard": 3.8,
    "mentality": 3.9,
    "rarity": "Noob"
  },
  {
    "name": "Yun Kwak",
    "year": 2028,
    "2k": "07:37.5",
    "weight": 135,
    "port": 2.1,
    "starboard": 2.3,
    "mentality": 2.7,
    "rarity": "Noob"
  },
  {
    "name": "Oscar Dong",
    "year": 2028,
    "2k": "07:50.0",
    "weight": 122,
    "port": 2,
    "starboard": 2.1,
    "mentality": 2.5,
    "rarity": "Noob"
  },
  {
    "name": "Arbi Tahmazi",
    "year": 2029,
    "2k": null,
    "weight": 193,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Brandon Madden",
    "year": 2029,
    "2k": null,
    "weight": 145,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Chak Shing Lin",
    "year": 2029,
    "2k": null,
    "weight": 167,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Connor Shaffery",
    "year": 2029,
    "2k": null,
    "weight": 145,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Deniz Karamete",
    "year": 2029,
    "2k": null,
    "weight": 144,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Elliot Bowen",
    "year": 2029,
    "2k": null,
    "weight": 169,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Joseph Lewis",
    "year": 2029,
    "2k": null,
    "weight": 199,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Kyeongyun Kwak",
    "year": 2029,
    "2k": null,
    "weight": 134,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Lucas Moya",
    "year": 2029,
    "2k": null,
    "weight": 146,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Max Mao",
    "year": 2029,
    "2k": null,
    "weight": 194,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Rohan Murthy",
    "year": 2029,
    "2k": null,
    "weight": 157,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Solomon Butler-Basner",
    "year": 2029,
    "2k": null,
    "weight": 155,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  }
];
