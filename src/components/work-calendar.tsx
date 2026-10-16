"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { WorkTask } from "@/components/work-client";
import { addCalendarDays, calendarMonthDays, deadlineCounts, formatCalendarDay, formatCalendarMonth,
  londonDay, moveCalendarMonth, taskDeadlines } from "@/lib/tasks/calendar";
import styles from "./work-calendar.module.css";

export function WorkCalendar({ tasks, renderTask }: { tasks: WorkTask[]; renderTask: (task: WorkTask) => ReactNode }) {
  const [today, setToday] = useState(() => londonDay(new Date()));
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(() => today);
  const focusDay = useRef(false);
  const dayButtons = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    const timer = window.setInterval(() => setToday(londonDay(new Date())), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (focusDay.current) { dayButtons.current.get(selectedDay)?.focus(); focusDay.current = false; }
  }, [selectedDay]);
  const { dated, undated } = taskDeadlines(tasks);
  const byDay = new Map<string, typeof dated>();
  for (const item of dated) byDay.set(item.day, [...(byDay.get(item.day) ?? []), item]);
  const monthTasks = dated.filter(item => item.day.startsWith(`${month}-`));
  const agenda = byDay.get(selectedDay) ?? [];
  const days = calendarMonthDays(month);
  const counts = deadlineCounts(monthTasks.map(item => item.task));
  function selectDay(day: string, keyboard = false) {
    focusDay.current = keyboard;
    setSelectedDay(day); setMonth(day.slice(0, 7));
  }
  function changeMonth(amount: number) {
    const next = moveCalendarMonth(month, amount);
    if (next) selectDay(`${next}-01`);
  }
  function keyDay(event: KeyboardEvent<HTMLButtonElement>, day: string) {
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in deltas)) return;
    event.preventDefault(); const next = addCalendarDays(day, deltas[event.key]);
    if (next) selectDay(next, true);
  }
  return <div className={styles.calendar}>
    <p className={styles.note}>Deadlines in returned work · Europe/London. Completed and cancelled dates are history. Shifts remain in My Schedule.</p>
    <div className={styles.toolbar} aria-label="Calendar month navigation">
      <button type="button" disabled={!moveCalendarMonth(month, -1)} onClick={() => changeMonth(-1)}>Previous month</button>
      <button type="button" onClick={() => { const day = londonDay(new Date()); setToday(day); selectDay(day); }}>Today</button>
      <button type="button" disabled={!moveCalendarMonth(month, 1)} onClick={() => changeMonth(1)}>Next month</button>
    </div>
    <div className={styles.layout}>
      <section className={styles.month} aria-labelledby="deadline-month-heading">
        <h2 id="deadline-month-heading">{formatCalendarMonth(month)}</h2>
        <p className={styles.note} role="status">{monthTasks.length} dated {monthTasks.length === 1 ? "task" : "tasks"} this month: {counts.open} open, {counts.covering} covering, {counts.done} done, {counts.cancelled} cancelled.</p>
        <p id="calendar-keyboard-help" className={styles.note}>Choose a date for its agenda. Arrow keys move by day or week.</p>
        <table className={styles.grid} aria-label={`${formatCalendarMonth(month)} deadline dates`} aria-describedby="calendar-keyboard-help">
          <thead><tr>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <th scope="col" key={day}>{day}</th>)}</tr></thead>
          <tbody>{Array.from({ length: days.length / 7 }, (_, row) => <tr key={row}>{days.slice(row * 7, row * 7 + 7).map((day, column) => {
            if (!day) return <td key={column} />;
            const entries = byDay.get(day) ?? [], state = deadlineCounts(entries.map(item => item.task));
            return <td key={day}><button type="button" ref={element => { if (element) dayButtons.current.set(day, element); else dayButtons.current.delete(day); }}
              className={`${styles.day} ${day.startsWith(`${month}-`) ? "" : styles.outside}`}
              aria-label={`${formatCalendarDay(day)}: ${entries.length} dated ${entries.length === 1 ? "task" : "tasks"}; ${state.open} open, ${state.covering} covering, ${state.done} done, ${state.cancelled} cancelled`}
              aria-pressed={day === selectedDay} aria-current={day === today ? "date" : undefined}
              tabIndex={day === selectedDay ? 0 : -1} onKeyDown={event => keyDay(event, day)} onClick={() => selectDay(day)}>
              <span>{Number(day.slice(-2))}</span>{entries.length > 0 && <span className={styles.count}>{entries.length} {entries.length === 1 ? "task" : "tasks"}</span>}
            </button></td>;
          })}</tr>)}</tbody>
        </table>
      </section>
      <section className={styles.agenda} aria-labelledby="deadline-agenda-heading">
        <h2 id="deadline-agenda-heading">{formatCalendarDay(selectedDay)}</h2>
        <p className={styles.note} role="status">{agenda.length} returned {agenda.length === 1 ? "task" : "tasks"} with deadlines on this date.</p>
        {agenda.length ? <ul className={styles.agendaList}>{agenda.map(item => <li key={item.task.id}>
          <p className={styles.dueTime}>{item.task.state === "OPEN" ? "Due" : "Historical due date"} · {item.time} · Europe/London</p>
          <ul className="work-list">{renderTask(item.task)}</ul>
        </li>)}</ul> : <p>No dated tasks for this day in the current results.</p>}
      </section>
    </div>
    <section className={styles.undated} aria-labelledby="undated-work-heading">
      <h2 id="undated-work-heading">Undated work <span>({undated.length})</span></h2>
      <p className={styles.note}>No usable CRM deadline in these results. Document and TFS work stays undated.</p>
      {undated.length ? <ul className="work-list">{undated.map(task => renderTask(
        // The existing card uses Date for its CRM label; suppress an unusable date in this view.
        task.dueAt && (task.sourceKind === "CRM_OPPORTUNITY" || task.sourceKind === "CRM_ORGANISATION") ? { ...task, dueAt: null } : task,
      ))}</ul> : <p>No undated work in the current results.</p>}
    </section>
  </div>;
}
