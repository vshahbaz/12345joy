export interface ImpactStat {
  id: string;
  label: string;
  value: string;
  detail: string;
}

export interface EventItem {
  id: string;
  title: string;
  location: string;
  date: string;
  time: string;
  category: string;
  energy: string;
  spotsLeft: number;
  image: string;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  city: string;
  points: number;
  streak: number;
  badge: string;
  image: string;
}

export interface StoryCard {
  id: string;
  title: string;
  subtitle: string;
  image: string;
}

export const impactStats: ImpactStat[] = [
  {
    id: 'volunteers',
    label: 'Volunteers',
    value: '1,500+',
    detail: 'Joy Dealers showing up across local neighborhoods.',
  },
  {
    id: 'events',
    label: 'Events',
    value: '250+',
    detail: 'Cleanup drives, meal service, mentoring, and wellness days.',
  },
  {
    id: 'hours',
    label: 'Hours served',
    value: '10,000+',
    detail: 'Real time poured back into the people and places we love.',
  },
];

export const featuredStories: StoryCard[] = [
  {
    id: '1',
    title: 'Joy in Action',
    subtitle: 'Neighborhood breakfast service with music, smiles, and warm meals.',
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: '2',
    title: 'Community Reset',
    subtitle: 'A sunset block cleanup that turned into a dance circle.',
    image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: '3',
    title: 'Mentor Moments',
    subtitle: 'Helping young creators ship their first passion projects.',
    image: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=1200&q=80',
  },
];

export const events: EventItem[] = [
  {
    id: 'evt-1',
    title: 'Camillus House Meal Service',
    location: 'Downtown Miami',
    date: 'Fri, Mar 14',
    time: '6:30 PM',
    category: 'Care',
    energy: 'Warm & hands-on',
    spotsLeft: 8,
    image: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'evt-2',
    title: 'Little Havana Joy Walk',
    location: 'Little Havana',
    date: 'Sat, Mar 15',
    time: '9:00 AM',
    category: 'Outreach',
    energy: 'High vibe',
    spotsLeft: 14,
    image: 'https://images.unsplash.com/photo-1529390079861-591de354faf5?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'evt-3',
    title: 'Youth Creator Lab',
    location: 'Overtown',
    date: 'Tue, Mar 18',
    time: '5:30 PM',
    category: 'Mentorship',
    energy: 'Creative',
    spotsLeft: 5,
    image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'evt-4',
    title: 'Beach Sunrise Cleanup',
    location: 'South Pointe',
    date: 'Sun, Mar 23',
    time: '7:00 AM',
    category: 'Environment',
    energy: 'Fresh start',
    spotsLeft: 21,
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  },
];

export const leaderboard: LeaderboardEntry[] = [
  {
    id: 'ld-1',
    name: 'Maya Thompson',
    city: 'Miami',
    points: 1480,
    streak: 12,
    badge: 'Connector',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'ld-2',
    name: 'Jordan Ellis',
    city: 'Fort Lauderdale',
    points: 1325,
    streak: 9,
    badge: 'Heartbeat',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'ld-3',
    name: 'Sofia Rivera',
    city: 'Miami Gardens',
    points: 1210,
    streak: 7,
    badge: 'Lightmaker',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'ld-4',
    name: 'Noah Bennett',
    city: 'Hialeah',
    points: 1155,
    streak: 6,
    badge: 'Uplifter',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
  },
];
