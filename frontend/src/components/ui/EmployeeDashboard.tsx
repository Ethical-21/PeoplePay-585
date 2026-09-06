import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface EmployeeDashboardProps {
  allocations: any[];
  requests: any[];
  attendances: any[];
}

export default function EmployeeDashboard({ allocations = [], requests = [], attendances = [] }: EmployeeDashboardProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate summaries
  const totalAllocated = useMemo(() => {
    return allocations.reduce((sum, a) => sum + (a.total_days || 0), 0);
  }, [allocations]);

  const remainingLeave = useMemo(() => {
    return allocations.reduce((sum, a) => sum + ((a.total_days || 0) - (a.used_days || 0)), 0);
  }, [allocations]);

  const currentMonthAttendances = useMemo(() => {
    return attendances.filter((a) => {
      const d = new Date(a.date);
      return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
    }).length;
  }, [attendances, currentDate]);

  // Calendar logic
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getDayEvents = (day: number) => {
    const targetDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const targetDateObj = new Date(targetDateStr);

    const isPresent = attendances.some(a => a.date === targetDateStr);
    
    // Check for leave requests spanning this day
    const leaveStatus = requests.reduce((acc, req) => {
      const start = new Date(req.start_date);
      const end = new Date(req.end_date);
      // set hours to 0 to compare dates safely
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      
      if (targetDateObj >= start && targetDateObj <= end) {
        return req.status; // pending, approved, refused, cancelled
      }
      return acc;
    }, null as string | null);

    return { isPresent, leaveStatus };
  };

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mb-6 animate-in fade-in">
      <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h3 className="font-semibold text-slate-800">Time Off & Attendance Dashboard</h3>
        
        {/* Summaries */}
        <div className="flex flex-wrap gap-4">
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex flex-col min-w-[120px]">
            <span className="text-xs text-slate-500 font-medium">Total Leave</span>
            <span className="text-lg font-bold text-slate-900">{totalAllocated} days</span>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex flex-col min-w-[120px]">
            <span className="text-xs text-slate-500 font-medium">Remaining Leave</span>
            <span className="text-lg font-bold text-primary-600">{remainingLeave} days</span>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex flex-col min-w-[120px]">
            <span className="text-xs text-slate-500 font-medium">Month Attendance</span>
            <span className="text-lg font-bold text-emerald-600">{currentMonthAttendances} days</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h4 className="text-lg font-bold text-slate-800">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h4>
            <div className="flex items-center gap-1">
              <button onClick={handlePrevMonth} className="p-1 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"><ChevronLeft size={20} /></button>
              <button onClick={handleNextMonth} className="p-1 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"><ChevronRight size={20} /></button>
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Present</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Approved</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Pending</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Rejected</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-slate-50 text-center py-2 text-xs font-semibold text-slate-500">
              {day}
            </div>
          ))}
          
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-white min-h-[80px] p-2 opacity-50"></div>
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const events = getDayEvents(day);
            const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
            
            return (
              <div key={day} className={`bg-white min-h-[80px] p-2 flex flex-col gap-1 border-t border-slate-100 ${isToday ? 'bg-primary-50/30' : ''}`}>
                <span className={`text-sm font-medium ${isToday ? 'text-primary-600' : 'text-slate-700'}`}>{day}</span>
                <div className="flex flex-col gap-1 mt-1">
                  {events.isPresent && (
                    <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      Present
                    </div>
                  )}
                  {events.leaveStatus === 'approved' && (
                    <div className="flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                      Leave
                    </div>
                  )}
                  {events.leaveStatus === 'pending' && (
                    <div className="flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                      Pending
                    </div>
                  )}
                  {events.leaveStatus === 'refused' && (
                    <div className="flex items-center gap-1 text-[10px] font-medium text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      Rejected
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
