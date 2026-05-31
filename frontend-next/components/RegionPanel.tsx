"use client";

import { useState } from "react";
import { Device, Forecast, RegionDetail } from "@/lib/types";
import { Mode, addDevice, saveForecast } from "@/lib/api";

const fmt = (v: number | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("ru-RU");

function Metric({ k, v }: { k: string; v: number | null | undefined }) {
  return (
    <div className="metric">
      <div className="k">{k}</div>
      <div className="v">{fmt(v)}</div>
    </div>
  );
}

function ForecastRow({
  regionId,
  forecast,
  mode,
  toast,
}: {
  regionId: number;
  forecast: Forecast;
  mode: Mode;
  toast: (m: string) => void;
}) {
  const [value, setValue] = useState(forecast.value);
  const [note, setNote] = useState(forecast.note);

  async function save() {
    try {
      await saveForecast(regionId, forecast.id, value, note, mode);
      toast("Прогноз сохранён");
    } catch {
      toast("Ошибка сохранения");
    }
  }

  return (
    <div className="fc">
      <div className="name">
        {forecast.metric} <span className="yr">· {forecast.horizon_year}</span>
      </div>
      <div className="fc-row">
        <input
          type="number"
          step="0.1"
          value={value}
          onChange={(e) => setValue(parseFloat(e.target.value))}
        />
        <span className="yr">{forecast.unit}</span>
        <input
          className="note"
          type="text"
          placeholder="комментарий"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="sm" onClick={save}>
          Сохранить
        </button>
      </div>
    </div>
  );
}

export default function RegionPanel({
  detail,
  mode,
  toast,
}: {
  detail: RegionDetail;
  mode: Mode;
  toast: (m: string) => void;
}) {
  const { region: r, indicators: i } = detail;
  const [devices, setDevices] = useState<Device[]>(detail.devices);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState(1);

  async function onAddDevice() {
    if (!name.trim()) {
      toast("Укажите наименование");
      return;
    }
    try {
      const created = await addDevice(
        r.id,
        { name: name.trim(), category: category.trim(), quantity: quantity || 1, status: "в эксплуатации" },
        mode
      );
      setDevices((d) => [...d, created]);
      setName("");
      setCategory("");
      setQuantity(1);
      toast("Устройство добавлено");
    } catch {
      toast("Ошибка добавления");
    }
  }

  return (
    <div>
      <h2>{r.name}</h2>
      <div className="okrug">
        {r.federal_okrug} ФО · население {fmt(r.population)}
      </div>

      <div className="card">
        <h3>Текущие показатели · {i ? i.period : "—"}</h3>
        <div className="grid2">
          {i ? (
            <>
              <Metric k="Больниц" v={i.hospitals} />
              <Metric k="Врачей на 10 тыс." v={i.doctors_per_10k} />
              <Metric k="Коек на 10 тыс." v={i.beds_per_10k} />
              <Metric k="ОПЖ, лет" v={i.life_expectancy} />
              <Metric k="Заболеваемость /100 тыс." v={i.incidence_rate} />
            </>
          ) : (
            <div className="metric">
              <div className="k">нет данных</div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Прогнозы (редактируемые)</h3>
        {detail.forecasts.length === 0 && (
          <div className="okrug">Прогнозы не заданы</div>
        )}
        {detail.forecasts.map((f) => (
          <ForecastRow key={f.id} regionId={r.id} forecast={f} mode={mode} toast={toast} />
        ))}
      </div>

      <div className="card">
        <h3>Медицинское оборудование</h3>
        {devices.length === 0 && <div className="okrug">Оборудование не добавлено</div>}
        {devices.map((dev) => (
          <div className="dev" key={dev.id}>
            <div>
              <div>{dev.name}</div>
              <div className="meta">
                {dev.category || "—"} · {dev.status}
              </div>
            </div>
            <div className="v">{dev.quantity} шт.</div>
          </div>
        ))}
        <div className="dev-form">
          <input
            className="full"
            placeholder="Наименование устройства"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="Категория (МРТ, КТ…)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          />
          <button className="full" onClick={onAddDevice}>
            + Добавить устройство
          </button>
        </div>
      </div>
    </div>
  );
}
