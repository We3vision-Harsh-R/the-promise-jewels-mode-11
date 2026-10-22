import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

// The inquiry chart, in its own file so the charting library is downloaded
// only when this chart is about to be drawn - the dashboard's numbers and
// tables do not wait for it.
export default function TrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="inquiryGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D8C287" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#D8C287" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.15)" />

        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#b9d4d1', fontSize: 12 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#b9d4d1', fontSize: 12 }} />

        <Tooltip
          contentStyle={{
            background: '#0E2B26',
            border: '1px solid rgba(216, 194, 135, 0.4)',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '13px',
          }}
          labelStyle={{ color: '#D8C287', fontWeight: 600, marginBottom: 4 }}
          itemStyle={{ color: '#d7e6e2' }}
        />

        <Area
          type="monotone"
          dataKey="inquiries"
          stroke="#D8C287"
          strokeWidth={3}
          fill="url(#inquiryGradient)"
          dot={{ r: 4, fill: '#D8C287' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
