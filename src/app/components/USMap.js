import React, { useMemo } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

const geoUrl = "/states-10m.json";

// Map state names to center coordinates (rough estimates for bubbles)
const stateCenters = {
  "AL": [-86.9023, 32.3182], "AK": [-152.4044, 61.3707], "AZ": [-111.4312, 33.7298], "AR": [-92.3731, 34.9697], 
  "CA": [-119.4179, 36.7783], "CO": [-105.3109, 39.0598], "CT": [-72.7554, 41.6032], "DE": [-75.5277, 39.3185], 
  "FL": [-81.5158, 27.9944], "GA": [-83.6431, 32.1656], "HI": [-157.4983, 21.0943], "ID": [-114.4788, 44.0682], 
  "IL": [-89.0022, 40.3495], "IN": [-86.1269, 39.8494], "IA": [-93.2105, 42.0115], "KS": [-98.4842, 39.0119], 
  "KY": [-84.2700, 37.6681], "LA": [-91.8678, 31.1695], "ME": [-69.3819, 44.6939], "MD": [-76.6413, 39.0639], 
  "MA": [-71.5301, 42.2302], "MI": [-84.5361, 43.3266], "MN": [-93.9002, 45.6945], "MS": [-89.3985, 32.7416], 
  "MO": [-92.2884, 38.4561], "MT": [-110.3626, 46.9219], "NE": [-98.2681, 41.1254], "NV": [-116.4194, 38.3135], 
  "NH": [-71.5653, 43.6805], "NJ": [-74.4057, 40.0583], "NM": [-106.2485, 34.8405], "NY": [-74.9481, 43.2994], 
  "NC": [-79.8064, 35.7596], "ND": [-99.9018, 47.5289], "OH": [-82.9071, 40.3888], "OK": [-96.9289, 35.5653], 
  "OR": [-122.0709, 43.8041], "PA": [-77.2098, 41.2033], "RI": [-71.4774, 41.5801], "SC": [-81.1637, 33.8361], 
  "SD": [-99.9018, 44.2998], "TN": [-86.5804, 35.7478], "TX": [-99.9018, 31.0545], "UT": [-111.8624, 40.1500], 
  "VT": [-72.5778, 44.5588], "VA": [-78.6569, 37.4316], "WA": [-121.4905, 47.7511], "WV": [-80.4549, 38.5976], 
  "WI": [-89.6165, 43.7844], "WY": [-107.2903, 43.0760]
};

const USMap = ({ topStates }) => {
  // Find max revenue to scale bubbles
  const maxRevenue = useMemo(() => {
    if (!topStates || topStates.length === 0) return 1;
    return Math.max(...topStates.map(s => s.won_revenue));
  }, [topStates]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ComposableMap projection="geoAlbersUsa" style={{ width: "100%", height: "100%" }}>
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#1e293b"
                stroke="#334155"
                strokeWidth={1}
                style={{
                  default: { outline: "none" },
                  hover: { fill: "#334155", outline: "none" },
                  pressed: { fill: "#1e293b", outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {topStates?.map((stateData) => {
          const coords = stateCenters[stateData.state];
          if (!coords || stateData.won_revenue === 0) return null;
          
          // Calculate bubble size (min 5, max 30)
          const size = 5 + (stateData.won_revenue / maxRevenue) * 25;

          return (
            <Marker key={stateData.state} coordinates={coords}>
              <circle r={size} fill="#10b981" opacity={0.6} />
              <text
                textAnchor="middle"
                y={size + 12}
                style={{ fontFamily: "system-ui", fill: "#94a3b8", fontSize: "10px" }}
              >
                {stateData.state}
              </text>
            </Marker>
          );
        })}
      </ComposableMap>
    </div>
  );
};

export default USMap;
