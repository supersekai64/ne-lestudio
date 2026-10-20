"use client";

import { useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { CalendarIcon, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PickerProps = {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  labelledBy?: string;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));

function DatePicker({ id, value, onValueChange, invalid, describedBy, labelledBy }: PickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISO(value) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  function chooseDate(date?: Date) {
    const next = date ? format(date, "yyyy-MM-dd") : "";
    if (next !== value) onValueChange(next);
    setOpen(false);
  }

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button id={id} type="button" variant="outline" className="date-time-trigger" aria-invalid={invalid} aria-describedby={describedBy} aria-labelledby={labelledBy ? `${labelledBy} ${id}-value` : undefined}>
        <span id={`${id}-value`}>{selected ? format(selected, "dd/MM/yyyy") : "Choisir une date"}</span><CalendarIcon className="size-4" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-auto p-0" aria-label="Choisir la date de l’événement">
      <Calendar mode="single" required selected={selected} defaultMonth={selected} onSelect={chooseDate} autoFocus weekStartsOn={1} />
      <div className="flex items-center justify-between gap-2 px-3 pb-3">
        <Button type="button" variant="ghost" size="sm" disabled={!selected} onClick={() => chooseDate()}>Effacer</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => chooseDate(new Date())}>Aujourd’hui</Button>
      </div>
    </PopoverContent>
  </Popover>;
}

function TimePicker({ id, value, onValueChange, invalid, describedBy, labelledBy }: PickerProps) {
  const [open, setOpen] = useState(false);
  const [hour, minute] = /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value.split(":") : ["", ""];

  function chooseTime(next: string) {
    if (next !== value) onValueChange(next);
  }

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button id={id} type="button" variant="outline" className="date-time-trigger" aria-invalid={invalid} aria-describedby={describedBy} aria-labelledby={labelledBy ? `${labelledBy} ${id}-value` : undefined}>
        <span id={`${id}-value`} data-placeholder={!value || undefined}>{value || "Choisir une heure"}</span><Clock3 className="size-4" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-72" aria-labelledby={`${id}-picker-title`}>
      <p id={`${id}-picker-title`} className="mb-4 font-medium">Heure de début</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${id}-hours`}>Heures</Label>
          <Select value={hour} onValueChange={(next) => chooseTime(`${next}:${minute || "00"}`)}>
            <SelectTrigger id={`${id}-hours`} className="w-full"><SelectValue placeholder="hh" /></SelectTrigger>
            <SelectContent className="max-h-64">{HOURS.map((entry) => <SelectItem key={entry} value={entry}>{entry}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-minutes`}>Minutes</Label>
          <Select value={minute} onValueChange={(next) => chooseTime(`${hour || "00"}:${next}`)}>
            <SelectTrigger id={`${id}-minutes`} className="w-full"><SelectValue placeholder="mm" /></SelectTrigger>
            <SelectContent className="max-h-64">{MINUTES.map((entry) => <SelectItem key={entry} value={entry}>{entry}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" disabled={!value} onClick={() => { chooseTime(""); setOpen(false); }}>Effacer</Button>
        <Button type="button" onClick={() => setOpen(false)}>Terminer</Button>
      </div>
    </PopoverContent>
  </Popover>;
}

export { DatePicker, TimePicker };
