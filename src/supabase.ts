import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Instantiate supabase client (uses fallback credentials to prevent startup crashes when unconfigured)
export const supabase = createClient(
  supabaseUrl || 'https://brave-zoo-dq7jp.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
);

// Fallback Mock Testimonials
const FALLBACK_RATINGS = [
  {
    id: "r_1",
    userName: "Kev_Gamer",
    feedback: "Swapped my key for Minecraft plugin configuration. Melonorian1 live-streamed the setup directly. A+ speed and absolute transparency.",
    projectType: "Minecraft Setup",
    rating: 5,
    userPhoto: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120",
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: "r_2",
    userName: "v_shinobi",
    feedback: "Built a customized server with extreme precision. Live proof was stream-shared. Unlocked my lobby within 3 hours. Paying with steam card is awesome.",
    projectType: "Discord Setup",
    rating: 5,
    userPhoto: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120",
    createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: "r_3",
    userName: "Sasha.V",
    feedback: "Requested customized AI Genz companion. The voice response and prompt rules are completely flawless. Will submit another order key soon!",
    projectType: "AI Chatbot",
    rating: 5,
    userPhoto: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120",
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
  }
];

// Fallback local storage services to allow 100% functional state in the iframe preview
const getLocal = <T>(key: string, defaultValue: T): T => {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setLocal = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Local storage sync error: ", e);
  }
};

export const supabaseService = {
  // 1. STATS METRICS
  getStats: async (): Promise<{ deliveredCount: number; overallRating: number }> => {
    if (!isSupabaseConfigured) {
      return getLocal('devxchange_stats', { deliveredCount: 147, overallRating: 4.9 });
    }
    try {
      const { data, error } = await supabase
        .from('stats')
        .select('*')
        .eq('id', 'platform')
        .maybeSingle();

      if (error || !data) {
        // Create initial stats row if it fails to find one
        const fallback = { deliveredCount: 147, overallRating: 4.9 };
        await supabase.from('stats').insert({ id: 'platform', ...fallback }).select();
        return fallback;
      }
      return {
        deliveredCount: typeof data.deliveredCount === 'number' ? data.deliveredCount : Number(data.delivered_count || 147),
        overallRating: typeof data.overallRating === 'number' ? data.overallRating : Number(data.overall_rating || 4.9),
      };
    } catch {
      return getLocal('devxchange_stats', { deliveredCount: 147, overallRating: 4.9 });
    }
  },

  // Increment metrics in fallbacks or cache
  incrementDeliveredCount: async () => {
    const stats = await supabaseService.getStats();
    stats.deliveredCount += 1;
    setLocal('devxchange_stats', stats);
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('stats')
          .update({ deliveredCount: stats.deliveredCount })
          .eq('id', 'platform');
      } catch (err) {
        console.error("Failed updating remote stats: ", err);
      }
    }
    return stats;
  },

  // 2. RATINGS / VERIFIED REVIEWS
  getRatings: async (): Promise<any[]> => {
    if (!isSupabaseConfigured) {
      return getLocal('devxchange_ratings', FALLBACK_RATINGS);
    }
    try {
      const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      if (!data || data.length === 0) {
        return FALLBACK_RATINGS;
      }
      return data.map(r => ({
        id: r.id,
        ticketId: r.ticket_id || r.ticketId,
        userId: r.user_id || r.userId,
        userName: r.user_name || r.userName,
        userPhoto: r.user_photo || r.userPhoto,
        rating: Number(r.rating),
        feedback: r.feedback,
        projectType: r.project_type || r.projectType,
        createdAt: r.created_at || r.createdAt
      }));
    } catch {
      return getLocal('devxchange_ratings', FALLBACK_RATINGS);
    }
  },

  submitReview: async (review: {
    ticketId: string;
    userId: string;
    userName: string;
    userPhoto: string;
    rating: number;
    feedback: string;
    projectType: string;
  }): Promise<void> => {
    const newReview = {
      id: `r_${Date.now()}`,
      ticket_id: review.ticketId,
      user_id: review.userId,
      user_name: review.userName,
      user_photo: review.userPhoto,
      rating: review.rating,
      feedback: review.feedback,
      project_type: review.projectType,
      created_at: new Date().toISOString()
    };

    // Save locally first
    const list = getLocal<any[]>('devxchange_ratings', FALLBACK_RATINGS);
    setLocal('devxchange_ratings', [newReview, ...list]);

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('ratings').insert([newReview]);
      if (error) {
        console.error("Supabase review submit failed: ", error);
        throw error;
      }
    }
  },

  // 3. TICKETS
  getTickets: async (userId: string): Promise<any[]> => {
    if (!isSupabaseConfigured) {
      const allLocal = getLocal<any[]>('devxchange_tickets', []);
      return allLocal.filter(t => t.userId === userId);
    }
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(t => ({
        id: t.id,
        discordUsername: t.discord_username || t.discordUsername,
        projectType: t.project_type || t.projectType,
        projectDetails: t.project_details || t.projectDetails,
        status: t.status,
        userId: t.user_id || t.userId,
        email: t.email,
        urgency: t.urgency,
        paymentMethod: t.payment_method || t.paymentMethod,
        createdAt: t.created_at || t.createdAt,
        updatedAt: t.updated_at || t.updatedAt
      }));
    } catch {
      const allLocal = getLocal<any[]>('devxchange_tickets', []);
      return allLocal.filter(t => t.userId === userId);
    }
  },

  createTicket: async (ticket: {
    id: string;
    discordUsername: string;
    projectType: string;
    projectDetails: string;
    status: string;
    userId: string;
    email: string;
    urgency: string;
    paymentMethod: string;
  }): Promise<void> => {
    const rawTicket = {
      id: ticket.id,
      discord_username: ticket.discordUsername,
      project_type: ticket.projectType,
      project_details: ticket.projectDetails,
      status: ticket.status,
      user_id: ticket.userId,
      email: ticket.email,
      urgency: ticket.urgency,
      payment_method: ticket.paymentMethod,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save locally
    const list = getLocal<any[]>('devxchange_tickets', []);
    setLocal('devxchange_tickets', [
      {
        id: ticket.id,
        discordUsername: ticket.discordUsername,
        projectType: ticket.projectType,
        projectDetails: ticket.projectDetails,
        status: ticket.status,
        userId: ticket.userId,
        email: ticket.email,
        urgency: ticket.urgency,
        paymentMethod: ticket.paymentMethod,
        createdAt: rawTicket.created_at,
        updatedAt: rawTicket.updated_at
      },
      ...list
    ]);

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('tickets').insert([rawTicket]);
      if (error) {
        console.error("Supabase ticket creation failed: ", error);
        throw error;
      }
    }
  },

  updateTicketStatus: async (ticketId: string, status: string): Promise<void> => {
    // Local update
    const list = getLocal<any[]>('devxchange_tickets', []);
    const updatedList = list.map(t => {
      if (t.id === ticketId) {
        return { ...t, status, updatedAt: new Date().toISOString() };
      }
      return t;
    });
    setLocal('devxchange_tickets', updatedList);

    // If marked completed, update stats
    if (status === 'completed') {
      await supabaseService.incrementDeliveredCount();
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', ticketId);
      if (error) {
        console.error("Supabase update status failed: ", error);
        throw error;
      }
    }
  }
};
