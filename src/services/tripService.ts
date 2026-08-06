import { Trip, DestinationPollOption, BarkadaActivity, ItineraryItem } from '../types/trip';
import { SpotItem, PlaceItem } from '../types/aiRecommendation';

const elnidoImg = require('../../assets/images/elnido.jpg');
const sagadaImg = require('../../assets/images/sagada.jpeg');
const zambalesImg = require('../../assets/images/zambales.jpg');
const bigLagoonImg = require('../../assets/images/biglagoon.jpg');
const nacpanImg = require('../../assets/images/nacpan.jpg');
const elnidoEscapeImg = require('../../assets/images/elnidoescape.jpg');

export class TripService {
  private static instance: TripService;

  private pollOptions: DestinationPollOption[] = [
    {
      id: 'p1',
      title: 'El Nido, Palawan',
      imagePath: elnidoImg,
      votes: 3,
      isVotedByMe: true,
      leaderComment: '"tara na sa El Nido!!" — Harry',
    },
    {
      id: 'p2',
      title: 'Sagada Sunrise',
      imagePath: sagadaImg,
      votes: 1,
      isVotedByMe: false,
      leaderComment: '"chill weather & coffee vibes" — Steven',
    },
    {
      id: 'p3',
      title: 'Zambales Beach Camp',
      imagePath: zambalesImg,
      votes: 1,
      isVotedByMe: false,
      leaderComment: '"near Manila & surfing!" — Ahiah',
    },
  ];

  private listeners: (() => void)[] = [];

  public static getInstance(): TripService {
    if (!TripService.instance) {
      TripService.instance = new TripService();
    }
    return TripService.instance;
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  public getPollOptions(): DestinationPollOption[] {
    return [...this.pollOptions];
  }

  public voteDestination(pollId: string) {
    this.pollOptions = this.pollOptions.map((item) => {
      if (item.id === pollId) {
        const newIsVoted = !item.isVotedByMe;
        const newVotes = newIsVoted ? item.votes + 1 : item.votes - 1;
        return { ...item, votes: newVotes, isVotedByMe: newIsVoted };
      }
      return item;
    });
    this.notify();
  }

  public getActiveTrip(): Trip {
    return {
      id: 'trip_1',
      title: 'El Nido Escape',
      destination: 'El Nido, Palawan',
      dateRange: 'Aug 14–17 · 5 barkadas',
      memberCount: 5,
      status: 'Active',
      imageUrl: elnidoEscapeImg,
      totalBudget: 30000,
      spentAmount: 18400,
      daysLeft: 5,
      weatherTemp: '29°C',
      weatherCondition: 'Sunny ☀️',
      nextActivityTitle: 'Island Hopping Tour A (Big Lagoon)',
      nextActivityTime: 'Tomorrow, 8:00 AM',
      day1Itinerary: [
        {
          id: 'i1',
          time: '07:30 AM',
          title: 'Assembly & Breakfast at Artcafe',
          category: 'Dining',
          location: 'El Nido Town Proper',
          estCost: '₱350/pax',
          note: 'Meet up at lobby by 7:15 AM sharp',
          isCompleted: true,
        },
        {
          id: 'i2',
          time: '09:00 AM',
          title: 'Island Hopping Tour A Kayaking',
          category: 'Activity',
          location: 'Big Lagoon',
          estCost: '₱1,200/pax',
          note: 'Includes environmental fee & kayak rental',
          isCompleted: false,
        },
        {
          id: 'i3',
          time: '01:00 PM',
          title: 'Seafood Buffet Lunch on Boat',
          category: 'Dining',
          location: 'Shimizu Island',
          estCost: 'Included in Tour',
          isCompleted: false,
        },
        {
          id: 'i4',
          time: '05:30 PM',
          title: 'Sunset Cocktails & Chill',
          category: 'Leisure',
          location: 'Las Cabañas Beach',
          estCost: '₱400/pax',
          isCompleted: false,
        },
      ],
    };
  }

  public getRecentActivities(): BarkadaActivity[] {
    return [
      {
        id: 'act1',
        memberName: 'Ahiah',
        action: 'voted El Nido, Palawan in destination poll',
        timeAgo: '10m ago',
        avatarBgHex: '#3B7A9E',
      },
      {
        id: 'act2',
        memberName: 'Travis',
        action: 'added ₱2,500 Grocery & Drinks expense',
        timeAgo: '1h ago',
        avatarBgHex: '#E2604A',
      },
      {
        id: 'act3',
        memberName: 'Harry',
        action: 'confirmed RSVP for El Nido trip (Confidence 100%)',
        timeAgo: '3h ago',
        avatarBgHex: '#F0A93E',
      },
    ];
  }

  public getSpots(): SpotItem[] {
    return [
      {
        id: 's1',
        name: 'Secret Lagoon',
        rating: '4.9 ★',
        category: 'Nature',
        imagePath: bigLagoonImg,
        fallbackColor: '#CDE7DF',
      },
      {
        id: 's2',
        name: 'Nacpan Beach',
        rating: '4.8 ★',
        category: 'Sunset Spot',
        imagePath: nacpanImg,
        fallbackColor: '#FDEBD3',
      },
    ];
  }

  public getPlaces(): PlaceItem[] {
    return [
      {
        id: 'pl1',
        title: 'Sea Breeze Grill',
        subtitle: 'Fresh Grill & Seafood · 0.4km away',
        priceOrTime: '₱450-800',
        unit: 'per head',
        iconName: 'utensils',
        iconBg: '#FDEBD3',
        iconColor: '#F0A93E',
      },
      {
        id: 'pl2',
        title: 'Spin Designer Hostel',
        subtitle: 'Boutique Stay · Town Center',
        priceOrTime: '₱1,800',
        unit: '/ night',
        iconName: 'home',
        iconBg: '#E4F0EA',
        iconColor: '#3A8E71',
      },
    ];
  }
}
