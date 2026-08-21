"use client";

import { useId, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BookOpen,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  GripVertical,
  LayoutDashboard,
  ListChecks,
  Plus,
  ShieldAlert,
  Sun,
  Truck,
  Wind,
  X,
} from "lucide-react";
import { saveHomeDashboardLayout, setDepartmentFlagLevel } from "@/app/home-actions";
import {
  FLAG_LEVELS,
  flagLevelLabel,
  HOME_WIDGET_CATALOG,
  type FlagLevel,
  type HomeDashboardPayload,
  type HomeWidgetType,
  type WeatherSnapshot,
} from "@/lib/home-dashboard-types";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/Sheet";
import { FireDangerMeter } from "@/components/FireDangerMeter";
import { cn } from "@/lib/cn";

function credentialUrgencyClass(daysUntil: number) {
  if (daysUntil < 0) return "text-destructive";
  if (daysUntil <= 30) return "text-amber-800";
  return "text-muted-foreground";
}

function weatherIcon(forecast: string) {
  const text = forecast.toLowerCase();
  if (text.includes("thunder")) return CloudLightning;
  if (text.includes("snow") || text.includes("sleet")) return CloudSnow;
  if (text.includes("rain") || text.includes("shower") || text.includes("storm")) return CloudRain;
  if (text.includes("fog") || text.includes("mist")) return CloudFog;
  if (text.includes("wind")) return Wind;
  if (text.includes("cloud") || text.includes("overcast")) return Cloud;
  if (text.includes("sun") || text.includes("clear") || text.includes("fair")) return Sun;
  return CloudSun;
}

function WidgetError({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}

function WidgetEmpty({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}

function WeatherBody({ weather }: { weather: WeatherSnapshot | { error: string } | null }) {
  if (!weather) return <WidgetEmpty message="Weather is not loaded." />;
  if ("error" in weather) return <WidgetError message={weather.error} />;
  const Icon = weatherIcon(weather.currentForecast);
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{weather.locationLabel}</p>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tracking-tight">
              {weather.currentTemp === null ? "—" : `${weather.currentTemp}°`}
            </span>
            <span className="text-xs text-muted-foreground">{weather.currentUnit}</span>
          </div>
          <p className="mt-0.5 text-sm">{weather.currentForecast}</p>
          {weather.currentWind ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{weather.currentWind}</p>
          ) : null}
        </div>
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {weather.days.map((day) => (
          <div key={day.dateKey} className="rounded-md border bg-muted/40 px-1.5 py-1.5">
            <p className="text-[11px] font-medium">{day.name}</p>
            <p className="mt-0.5 text-sm font-semibold">
              {day.high === null ? "—" : `${day.high}°`}
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                {day.low === null ? "" : `/ ${day.low}°`}
              </span>
            </p>
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-muted-foreground">{day.forecast}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlagBody({
  flag,
  canEdit,
  pending,
  onSetLevel,
}: {
  flag: HomeDashboardPayload["data"]["flag"];
  canEdit: boolean;
  pending: boolean;
  onSetLevel: (level: FlagLevel) => void;
}) {
  if (!flag) return <WidgetEmpty message="Fire danger is not loaded." />;
  const warning = flag.alerts[0] ?? null;
  return (
    <div className="space-y-2.5">
      <FireDangerMeter
        level={flag.level}
        canEdit={canEdit && !pending}
        onSelect={canEdit ? onSetLevel : undefined}
      />
      <div className="text-center">
        <p className="text-base font-semibold leading-none">{flagLevelLabel(flag.level)}</p>
        {flag.updatedAt ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Posted
            {flag.updatedByName ? ` by ${flag.updatedByName}` : ""}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">No fire-danger rating posted yet.</p>
        )}
      </div>
      {warning ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5">
          <p className="text-sm font-medium text-destructive">{warning.event}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{warning.headline}</p>
        </div>
      ) : null}
      {canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={pending}>
              {pending ? "Saving..." : "Set rating"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {FLAG_LEVELS.map((level) => (
              <DropdownMenuItem key={level} onSelect={() => onSetLevel(level)}>
                {flagLevelLabel(level)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function UsFlagGlyph() {
  const stripes = Array.from({ length: 13 }, (_, index) => index);
  const starRows = Array.from({ length: 9 }, (_, row) => {
    const count = row % 2 === 0 ? 6 : 5;
    const offsetX = row % 2 === 0 ? 8.2 : 16.4;
    return Array.from({ length: count }, (_, col) => ({
      x: offsetX + col * 16.4,
      y: 6.5 + row * 7.4,
    }));
  }).flat();

  return (
    <svg viewBox="0 0 247 130" className="h-full w-full" aria-hidden>
      {stripes.map((index) => (
        <rect
          key={index}
          x="0"
          y={index * 10}
          width="247"
          height="10"
          fill={index % 2 === 0 ? "#B22234" : "#FFFFFF"}
        />
      ))}
      <rect x="0" y="0" width="98.8" height="70" fill="#3C3B6E" />
      {starRows.map((star) => (
        <circle key={`${star.x}-${star.y}`} cx={star.x} cy={star.y} r="2.1" fill="#FFFFFF" />
      ))}
    </svg>
  );
}

function FlagMastBody({ flagMast }: { flagMast: HomeDashboardPayload["data"]["flagMast"] }) {
  if (!flagMast) return <WidgetEmpty message="Flag status is not loaded." />;
  if ("error" in flagMast) return <WidgetError message={flagMast.error} />;
  const half = flagMast.position === "half";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-11 shrink-0">
          <div className="absolute inset-y-0 left-1 w-1.5 rounded-sm bg-zinc-400" />
          <div className={cn("absolute left-2.5 h-6 w-9 overflow-hidden rounded-[1px] shadow-sm", half ? "top-6" : "top-0.5")}>
            <UsFlagGlyph />
          </div>
        </div>
        <div>
          <p className="text-xl font-semibold leading-none">{half ? "Half-staff" : "Full staff"}</p>
          {half ? (
            <>
              {flagMast.reason ? <p className="mt-1 text-sm text-muted-foreground">{flagMast.reason}</p> : null}
              {flagMast.source ? <p className="mt-1 text-xs text-muted-foreground">{flagMast.source}</p> : null}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Fly the U.S. flag at the top of the staff.</p>
          )}
        </div>
      </div>
      {flagMast.idahoPosition && flagMast.idahoPosition !== flagMast.position ? (
        <p className="text-xs text-muted-foreground">
          Idaho: {flagMast.idahoPosition === "half" ? "half-staff" : "full staff"}
        </p>
      ) : null}
    </div>
  );
}

function WidgetBody({
  type,
  payload,
  pending,
  onSetFlag,
}: {
  type: HomeWidgetType;
  payload: HomeDashboardPayload;
  pending: boolean;
  onSetFlag: (level: FlagLevel) => void;
}) {
  if (type === "weather") return <WeatherBody weather={payload.data.weather} />;
  if (type === "fire_danger") {
    return (
      <FlagBody flag={payload.data.flag} canEdit={payload.canEditFlag} pending={pending} onSetLevel={onSetFlag} />
    );
  }
  if (type === "flag_mast") {
    return <FlagMastBody flagMast={payload.data.flagMast} />;
  }
  if (type === "apparatus_oos") {
    const rows = payload.data.apparatus;
    if (!rows) return <WidgetEmpty message="Apparatus status is not loaded." />;
    if ("error" in rows) return <WidgetError message={rows.error} />;
    if (rows.length === 0) return <WidgetEmpty message="All apparatus are in service." />;
    return (
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/assets/${row.id}`}
              className="flex items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-muted/50"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Truck className="h-4 w-4 text-muted-foreground" />
                {row.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {[row.typeLabel, row.station].filter(Boolean).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  if (type === "approvals_queue") {
    const rows = payload.data.approvals;
    if (!rows) return <WidgetEmpty message="Approvals are not loaded." />;
    if ("error" in rows) return <WidgetError message={rows.error} />;
    if (rows.length === 0) return <WidgetEmpty message="No documents are waiting on your stage." />;
    return (
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={`/approval-tracker/${row.id}`} className="block rounded-md px-1 py-1 hover:bg-muted/50">
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                  {row.title}
                </span>
                <Badge variant="outline">{row.daysInStage}</Badge>
              </div>
              <p className="mt-0.5 pl-6 text-xs text-muted-foreground">
                {row.docTypeLabel} · {row.stageLabel}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  if (type === "open_taskbooks") {
    const rows = payload.data.taskbooks;
    if (!rows) return <WidgetEmpty message="Taskbooks are not loaded." />;
    if ("error" in rows) return <WidgetError message={rows.error} />;
    if (rows.length === 0) return <WidgetEmpty message="You have no open taskbooks." />;
    return (
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/personnel/${payload.profileId}`}
              className="flex items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-muted/50"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                {row.rank}
              </span>
              <span className={cn("text-xs", row.overdue ? "text-destructive" : "text-muted-foreground")}>
                {row.dueLabel ?? row.statusLabel}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  if (type === "expiring_credentials") {
    const rows = payload.data.expiringCredentials;
    if (!rows) return <WidgetEmpty message="Expiring certifications are not loaded." />;
    if ("error" in rows) return <WidgetError message={rows.error} />;
    if (rows.length === 0) {
      return <WidgetEmpty message="No certifications or EMS licenses expire in the next six months." />;
    }
    return (
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={`${row.kind}-${row.id}`}>
            <Link
              href={`/personnel/${payload.profileId}#${row.sectionId}`}
              className="block rounded-md px-1 py-1 hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{row.label}</span>
                </span>
                <span
                  className={cn(
                    "max-w-[7.5rem] shrink-0 text-right text-xs font-medium",
                    credentialUrgencyClass(row.daysUntil)
                  )}
                >
                  {row.whenLabel}
                </span>
              </div>
              <p className="mt-0.5 pl-6 text-xs text-muted-foreground">
                {row.kindLabel} · {formatDate(row.expiresOn)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return <WidgetEmpty message="This widget is unavailable." />;
}

function SortableWidgetCard({
  type,
  disabled,
  onRemove,
  children,
}: {
  type: HomeWidgetType;
  disabled: boolean;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: type,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform) || undefined,
    transition: transition || undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "z-10 opacity-80")}>
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
          <CardTitle className="text-sm font-semibold">
            {HOME_WIDGET_CATALOG[type]?.title ?? type}
          </CardTitle>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
              aria-label={`Reorder ${HOME_WIDGET_CATALOG[type]?.title ?? type}`}
              disabled={disabled}
              suppressHydrationWarning
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label={`Remove ${HOME_WIDGET_CATALOG[type]?.title ?? type}`}
              onClick={onRemove}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">{children}</CardContent>
      </Card>
    </div>
  );
}

export function HomeDashboard({ payload }: { payload: HomeDashboardPayload }) {
  const dndContextId = useId();
  const [widgets, setWidgets] = useState<HomeWidgetType[]>(payload.widgets);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const unused = useMemo(
    () => payload.availableWidgets.filter((item) => !widgets.includes(item.type)),
    [payload.availableWidgets, widgets]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function persist(next: HomeWidgetType[]) {
    const previous = widgets;
    setWidgets(next);
    setError(null);
    startTransition(async () => {
      try {
        await saveHomeDashboardLayout(next);
      } catch (err) {
        setWidgets(previous);
        setError(err instanceof Error ? err.message : "Could not save dashboard.");
      }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = widgets.indexOf(active.id as HomeWidgetType);
    const newIndex = widgets.indexOf(over.id as HomeWidgetType);
    if (oldIndex < 0 || newIndex < 0) return;
    persist(arrayMove(widgets, oldIndex, newIndex));
  }

  function removeWidget(type: HomeWidgetType) {
    persist(widgets.filter((item) => item !== type));
  }

  function addWidget(type: HomeWidgetType) {
    if (widgets.includes(type)) return;
    persist([...widgets, type]);
    setAddOpen(false);
  }

  function handleSetFlag(level: FlagLevel) {
    setError(null);
    startTransition(async () => {
      try {
        await setDepartmentFlagLevel(level);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update fire danger.");
      }
    });
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Dashboard</h1>
          </div>
          <p className="text-lg text-muted-foreground">Good to see you, {payload.greetingName}.</p>
        </div>
        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger asChild>
            <Button size="sm" disabled={unused.length === 0}>
              <Plus className="h-4 w-4" />
              Add widget
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Add a widget</SheetTitle>
              <SheetDescription>Choose what should show on your dashboard.</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-2">
              {unused.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => addWidget(item.type)}
                  className="w-full rounded-md border px-3 py-3 text-left hover:bg-accent"
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {error ? (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!payload.layoutPersisted ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Widget layout is not saved yet. Run the home dashboard migration to keep your widgets.
        </p>
      ) : null}

      {widgets.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground">No widgets on your dashboard.</p>
          <Button className="mt-4" size="sm" onClick={() => setAddOpen(true)} disabled={unused.length === 0}>
            <Plus className="h-4 w-4" />
            Add widget
          </Button>
        </div>
      ) : (
        <DndContext
          id={dndContextId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={widgets} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {widgets.filter((type) => HOME_WIDGET_CATALOG[type]).map((type) => (
                <SortableWidgetCard key={type} type={type} disabled={pending} onRemove={() => removeWidget(type)}>
                  <WidgetBody type={type} payload={payload} pending={pending} onSetFlag={handleSetFlag} />
                </SortableWidgetCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
