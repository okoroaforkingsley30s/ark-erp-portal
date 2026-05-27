import React from 'react';
import { Card } from '@/components/ui/card';
import { Users, MapPin, Calendar, Clock, FileText, CreditCard, Gift, Award, BookOpen, Star } from 'lucide-react';
import { format, isToday, addDays } from 'date-fns';

export default function HRDashboard({ employees, attendance, leaveRequests, loans, trainings, reviews, holidays }) {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const activeEmployees = employees.filter(e => e.employment_status === 'Active').length;

  const byCountry = employees.reduce((acc, e) => { acc[e.country] = (acc[e.country] || 0) + 1; return acc; }, {});
  const byDept = employees.reduce((acc, e) => { acc[e.department] = (acc[e.department] || 0) + 1; return acc; }, {});

  const todayAttendance = attendance.filter(a => a.date === todayStr);
  const lateToday = todayAttendance.filter(a => a.punctuality_status === 'Late' || a.punctuality_status === 'Very Late').length;

  const pendingLeave = leaveRequests.filter(l => l.approval_status === 'Pending').length;
  const activeLoans = loans.filter(l => l.clearance_status === 'Active' && l.approval_status === 'Approved').length;

  // Upcoming birthdays (next 30 days)
  const upcomingBirthdays = employees.filter(e => {
    if (!e.date_of_birth) return false;
    const dob = new Date(e.date_of_birth);
    const thisYearBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
    if (thisYearBday < today) thisYearBday.setFullYear(today.getFullYear() + 1);
    return (thisYearBday - today) / (1000 * 60 * 60 * 24) <= 30;
  });

  const upcomingAnniversaries = employees.filter(e => {
    if (!e.date_of_employment) return false;
    const doe = new Date(e.date_of_employment);
    const thisYearAnn = new Date(today.getFullYear(), doe.getMonth(), doe.getDate());
    if (thisYearAnn < today) thisYearAnn.setFullYear(today.getFullYear() + 1);
    return (thisYearAnn - today) / (1000 * 60 * 60 * 24) <= 30;
  });

  const upcomingHolidays = holidays.filter(h => {
    const hDate = new Date(h.holiday_date);
    return hDate >= today && hDate <= addDays(today, 30);
  });

  const upcomingReviews = reviews.filter(r => {
    if (!r.next_review_date) return false;
    const rd = new Date(r.next_review_date);
    return rd >= today && rd <= addDays(today, 30);
  });

  const cards = [
    { label: 'Total Employees', value: activeEmployees, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Attendance Today', value: todayAttendance.length, icon: Clock, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Late Arrivals', value: lateToday, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Pending Leave', value: pendingLeave, icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Active Loans', value: activeLoans, icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Upcoming Birthdays', value: upcomingBirthdays.length, icon: Gift, color: 'text-pink-600', bg: 'bg-pink-50' },
    { label: 'Work Anniversaries', value: upcomingAnniversaries.length, icon: Award, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Upcoming Holidays', value: upcomingHolidays.length, icon: Calendar, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Upcoming Reviews', value: upcomingReviews.length, icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Recent Trainings', value: trainings.filter(t => t.training_status === 'Completed').length, icon: BookOpen, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map(c => (
          <Card key={c.label} className="p-4">
            <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center mb-2`}>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By Country */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" />Employees by Country</h3>
          <div className="space-y-2">
            {Object.entries(byCountry).sort((a,b) => b[1]-a[1]).map(([country, count]) => (
              <div key={country} className="flex items-center justify-between">
                <span className="text-sm">{country}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 bg-primary rounded-full" style={{ width: `${Math.max(20, count * 20)}px` }} />
                  <span className="text-sm font-medium w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(byCountry).length === 0 && <p className="text-sm text-muted-foreground">No employees yet</p>}
          </div>
        </Card>

        {/* By Department */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Employees by Department</h3>
          <div className="space-y-2">
            {Object.entries(byDept).sort((a,b) => b[1]-a[1]).map(([dept, count]) => (
              <div key={dept} className="flex items-center justify-between">
                <span className="text-sm">{dept}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 bg-blue-400 rounded-full" style={{ width: `${Math.max(20, count * 20)}px` }} />
                  <span className="text-sm font-medium w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(byDept).length === 0 && <p className="text-sm text-muted-foreground">No employees yet</p>}
          </div>
        </Card>

        {/* Upcoming Birthdays */}
        {upcomingBirthdays.length > 0 && (
          <Card className="p-4 border-pink-200 bg-pink-50/30">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Gift className="w-4 h-4 text-pink-600" />Upcoming Birthdays</h3>
            <div className="space-y-2">
              {upcomingBirthdays.slice(0, 5).map(e => (
                <div key={e.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{e.full_name}</span>
                  <span className="text-muted-foreground">{e.date_of_birth ? format(new Date(new Date().getFullYear(), new Date(e.date_of_birth).getMonth(), new Date(e.date_of_birth).getDate()), 'MMM d') : ''}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Upcoming Holidays */}
        {upcomingHolidays.length > 0 && (
          <Card className="p-4 border-teal-200 bg-teal-50/30">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-teal-600" />Upcoming Holidays</h3>
            <div className="space-y-2">
              {upcomingHolidays.slice(0, 5).map(h => (
                <div key={h.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{h.holiday_name}</span>
                  <span className="text-muted-foreground">{format(new Date(h.holiday_date), 'MMM d')} · {h.country}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}