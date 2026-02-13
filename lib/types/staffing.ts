export type StaffingProfile = {
  [dayOfWeek: string]: {
    [slot: string]: number;
  };
};

export type SchoolHoliday = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
};