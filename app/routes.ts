import {type RouteConfig, index, route} from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("practice/:exerciseId", "routes/practice.tsx"),
    route("time-trial/:exerciseId", "routes/time-trial.tsx"),
    route("rhythm/:exerciseId", "routes/rhythm.tsx"),
    route("settings", "routes/settings.tsx"),
] satisfies RouteConfig;
