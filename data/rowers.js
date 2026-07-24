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
    "rarity": "Generational",
    "medals": [
      { "year": 2025, "boat": "1V", "placement": "Silver" },
      { "year": 2024, "boat": "1V", "placement": "Silver" },
      { "year": 2023, "boat": "2V", "placement": "Gold" },
      { "year": 2022, "boat": "F8", "placement": "Bronze" }
    ]
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
    "medals": [
      { "year": 2025, "boat": "1V", "placement": "Silver" },
      { "year": 2024, "boat": "1V", "placement": "Silver" },
      { "year": 2023, "boat": "1V", "placement": "Gold" },
      { "year": 2022, "boat": "F8", "placement": "Bronze" }
    ]
  },
  {
    "name": "Carson Fast",
    "year": 2026,
    "2k": "06:25.5",
    "weight": 173.0,
    "port": 4.3,
    "starboard": 3.1,
    "mentality": 4.8,
    "rarity": "Generational",
    "medals": [
      { "year": 2025, "boat": "1V", "placement": "Silver" },
      { "year": 2024, "boat": "2V", "placement": "Silver" }
    ]
  },
  {
    "name": "Henry Terrell",
    "year": 2025,
    "2k": "06:37.2",
    "weight": 200.0,
    "port": 3.9,
    "starboard": 3.2,
    "mentality": 4.0,
    "rarity": "Pretty Good",
    "medals": [
      { "year": 2025, "boat": "1V", "placement": "Silver" },
      { "year": 2024, "boat": "2V", "placement": "Silver" },
      { "year": 2023, "boat": "3V", "placement": "Gold" },
      { "year": 2022, "boat": "F8", "placement": "Bronze" }
    ]
  },
  {
    "name": "Matthew Matar",
    "year": 2025,
    "2k": "06:38.1",
    "weight": 190.5,
    "port": 2.0,
    "starboard": 4.1,
    "mentality": 3.9,
    "rarity": "Pretty Good",
    "medals": [
      { "year": 2025, "boat": "1V", "placement": "Silver" },
      { "year": 2024, "boat": "2V", "placement": "Silver" },
      { "year": 2023, "boat": "3V", "placement": "Gold" },
      { "year": 2022, "boat": "F8", "placement": "Bronze" }
    ]
  },
  {
    "name": "Adrian Wiklund",
    "year": 2027,
    "2k": "06:38.3",
    "weight": 188.0,
    "port": 3.8,
    "starboard": 2.3,
    "mentality": 4.0,
    "rarity": "Pretty Good",
    "medals": []
  },
  {
    "name": "Jack Kirk",
    "year": 2025,
    "2k": "06:39.7",
    "weight": 179.6,
    "port": 4.0,
    "starboard": 4.1,
    "mentality": 4.2,
    "rarity": "Pretty Good",
    "medals": [
      { "year": 2025, "boat": "1V", "placement": "Silver" },
      { "year": 2024, "boat": "1V", "placement": "Silver" },
      { "year": 2023, "boat": "2V", "placement": "Gold" },
      { "year": 2022, "boat": "4V", "placement": "Gold" }
    ]
  },
  {
    "name": "Andrew Egorin",
    "year": 2025,
    "2k": "06:46.1",
    "weight": 148.5,
    "port": 4.2,
    "starboard": 4.3,
    "mentality": 4.9,
    "rarity": "Pretty Good",
    "medals": [
      { "year": 2025, "boat": "1V", "placement": "Silver" },
      { "year": 2024, "boat": "1V", "placement": "Silver" },
      { "year": 2023, "boat": "2V", "placement": "Gold" },
      { "year": 2022, "boat": "F8", "placement": "Bronze" }
    ]
  },
  {
    "name": "Minh Tran",
    "year": 2027,
    "2k": "06:35.6",
    "weight": 151.0,
    "port": 4.4,
    "starboard": 3.9,
    "mentality": 4.2,
    "rarity": "Generational",
    "medals": []
  },
  {
    "name": "Julian Schatz",
    "year": 2028,
    "2k": "06:57.2",
    "weight": 151.0,
    "port": 3.9,
    "starboard": 2.0,
    "mentality": 3.7,
    "rarity": "Mid",
    "medals": [
      { "year": 2025, "boat": "F8", "placement": "Bronze" }
    ]
  },
  {
    "name": "Alex Barnes",
    "year": 2025,
    "2k": "06:57.4",
    "weight": 145.0,
    "port": 4.4,
    "starboard": 2.5,
    "mentality": 3.3,
    "rarity": "Noob",
    "medals": [
      { "year": 2025, "boat": "1V", "placement": "Silver" },
      { "year": 2024, "boat": "3V", "placement": "Silver" },
      { "year": 2023, "boat": "2V", "placement": "Gold" },
      { "year": 2022, "boat": "4V", "placement": "Gold" }
    ]
  },
  {
    "name": "Danny Luo",
    "year": 2028,
    "2k": "06:58.4",
    "weight": 172.0,
    "port": 3.2,
    "starboard": 3.0,
    "mentality": 3.7,
    "rarity": "Mid",
    "medals": [
      { "year": 2025, "boat": "F8", "placement": "Bronze" }
    ]
  },
  {
    "name": "Rieden Rebugio",
    "year": 2028,
    "2k": "06:59.2",
    "weight": 159.0,
    "port": 3.0,
    "starboard": 3.3,
    "mentality": 2.7,
    "rarity": "Mid",
    "medals": [
      { "year": 2025, "boat": "4V", "placement": "Gold" }
    ]
  },
  {
    "name": "Sean Noh",
    "year": 2027,
    "2k": "06:59.2",
    "weight": 147.8,
    "port": 3.6,
    "starboard": 2.7,
    "mentality": 4.4,
    "rarity": "Mid",
    "medals": []
  },
  {
    "name": "Nathaniel Lee",
    "year": 2027,
    "2k": "07:06.0",
    "weight": 168.0,
    "port": 3.0,
    "starboard": 3.6,
    "mentality": 3.6,
    "rarity": "Mid",
    "medals": []
  },
  {
    "name": "Owen Kelly",
    "year": 2027,
    "2k": "07:09.0",
    "weight": 144.0,
    "port": 1.9,
    "starboard": 3.6,
    "mentality": 3.7,
    "rarity": "Mid",
    "medals": []
  },
  {
    "name": "James Millward (Rower)",
    "year": 2026,
    "2k": "07:09.6",
    "weight": 138.7,
    "port": 2.4,
    "starboard": 3.2,
    "mentality": 3.1,
    "rarity": "Noob",
    "medals": []
  },
  {
    "name": "Alden Strubhar",
    "year": 2028,
    "2k": "07:10.0",
    "weight": 181.0,
    "port": 2.8,
    "starboard": 3.1,
    "mentality": 3.9,
    "rarity": "Mid",
    "medals": [
      { "year": 2025, "boat": "F8", "placement": "Bronze" }
    ]
  },
  {
    "name": "Holden Saunders",
    "year": 2026,
    "2k": "07:10.3",
    "weight": 140.0,
    "port": 3.9,
    "starboard": 4.1,
    "mentality": 3.9,
    "rarity": "Mid",
    "medals": [
      { "year": 2024, "boat": "3V", "placement": "Silver" }
    ]
  },
  {
    "name": "Finnegan Switzer",
    "year": 2025,
    "2k": "07:10.6",
    "weight": 151.0,
    "port": 3.3,
    "starboard": 3.9,
    "mentality": 3.8,
    "rarity": "Noob",
    "medals": []
  },
  {
    "name": "Shaheen Tahir",
    "year": 2028,
    "2k": "07:14.0",
    "weight": 153.0,
    "port": 3.6,
    "starboard": 2.8,
    "mentality": 3.7,
    "rarity": "Mid",
    "medals": [
      { "year": 2025, "boat": "F8", "placement": "Bronze" }
    ]
  },
  {
    "name": "Colton Nagel",
    "year": 2028,
    "2k": "07:16.8",
    "weight": 144.0,
    "port": 2.7,
    "starboard": 3.1,
    "mentality": 3.9,
    "rarity": "Mid",
    "medals": [
      { "year": 2025, "boat": "F8", "placement": "Bronze" }
    ]
  },
  {
    "name": "Arham Jain",
    "year": 2027,
    "2k": "07:19.2",
    "weight": 123.4,
    "port": 2.7,
    "starboard": 3.7,
    "mentality": 2.7,
    "rarity": "Noob",
    "medals": []
  },
  {
    "name": "Ethan Hoffman",
    "year": 2028,
    "2k": "07:19.3",
    "weight": 133.0,
    "port": 3.5,
    "starboard": 3.5,
    "mentality": 4.4,
    "rarity": "Mid",
    "medals": [
      { "year": 2025, "boat": "F8", "placement": "Bronze" }
    ]
  },
  {
    "name": "Alex Absher",
    "year": 2028,
    "2k": "07:23.0",
    "weight": 184.0,
    "port": 2.5,
    "starboard": 2.6,
    "mentality": 3.0,
    "rarity": "Noob",
    "medals": []
  },
  {
    "name": "Jainam Shah",
    "year": 2027,
    "2k": "07:28.8",
    "weight": 161.0,
    "port": 2.4,
    "starboard": 2.5,
    "mentality": 2.5,
    "rarity": "Noob",
    "medals": []
  },
  {
    "name": "Abhay Shukla",
    "year": 2028,
    "2k": "07:29.9",
    "weight": 152.0,
    "port": 2.3,
    "starboard": 2.9,
    "mentality": 2.8,
    "rarity": "Noob",
    "medals": []
  },
  {
    "name": "Theodor Nedelescu",
    "year": 2028,
    "2k": "07:33.8",
    "weight": 144.0,
    "port": 3.6,
    "starboard": 2.4,
    "mentality": 2.8,
    "rarity": "Noob",
    "medals": []
  },
  {
    "name": "Mickey Bekele",
    "year": 2027,
    "2k": "07:35.6",
    "weight": 132.0,
    "port": 2.7,
    "starboard": 3.8,
    "mentality": 3.9,
    "rarity": "Noob",
    "medals": []
  },
  {
    "name": "Yun Kwak",
    "year": 2028,
    "2k": "07:37.5",
    "weight": 135.0,
    "port": 2.1,
    "starboard": 2.3,
    "mentality": 2.7,
    "rarity": "Noob",
    "medals": []
  },
  {
    "name": "Oscar Dong",
    "year": 2028,
    "2k": "07:50.0",
    "weight": 122.0,
    "port": 2.0,
    "starboard": 2.1,
    "mentality": 2.5,
    "rarity": "Noob",
    "medals": []
  },
  {
    "name": "Arbi Tahmazi",
    "year": 2029,
    "2k": null,
    "weight": 193.0,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Brandon Madden",
    "year": 2029,
    "2k": null,
    "weight": 145.0,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Chak Shing Lin",
    "year": 2029,
    "2k": null,
    "weight": 167.0,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Connor Shaffery",
    "year": 2029,
    "2k": null,
    "weight": 145.0,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Deniz Karamete",
    "year": 2029,
    "2k": null,
    "weight": 144.0,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Elliot Bowen",
    "year": 2029,
    "2k": null,
    "weight": 169.0,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Joseph Lewis",
    "year": 2029,
    "2k": null,
    "weight": 199.0,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Kyeongyun Kwak",
    "year": 2029,
    "2k": null,
    "weight": 134.0,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Lucas Moya",
    "year": 2029,
    "2k": null,
    "weight": 146.0,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Max Mao",
    "year": 2029,
    "2k": null,
    "weight": 194.0,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Rohan Murthy",
    "year": 2029,
    "2k": null,
    "weight": 157.0,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  },
  {
    "name": "Solomon Butler-Basner",
    "year": 2029,
    "2k": null,
    "weight": 155.0,
    "port": null,
    "starboard": null,
    "mentality": null,
    "rarity": null
  }
];
