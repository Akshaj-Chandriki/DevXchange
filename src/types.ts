export interface PortfolioItem {
  id: string;
  title: string;
  category: 'ai' | 'minecraft' | 'discord' | 'custom';
  description: string;
  detailedDescription: string;
  imagePlaceholder: string;
  tags: string[];
  features: string[];
}

export type PaymentMethod =
  | 'steam_gift'
  | 'steam_game'
  | 'amazon_gift'
  | 'robux'
  | 'other_gift';

export interface ProjectTier {
  id: string;
  name: string;
  priceEstimate: string;
  deliveryTime: string;
  icon: string;
}
