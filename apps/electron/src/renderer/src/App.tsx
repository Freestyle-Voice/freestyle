import AppPage from "@renderer/pages/app";
import NotFoundPage from "@renderer/pages/not-found";
import OnboardingPage from "@renderer/pages/onboarding";
import DictionaryPage from "@renderer/pages/settings/dictionary";
import FeedbackPage from "@renderer/pages/settings/feedback";
import FormatsPage from "@renderer/pages/settings/formats";
import GeneralSettingsPage from "@renderer/pages/settings/general";
import HistoryPage from "@renderer/pages/settings/history";
import ModelsPage from "@renderer/pages/settings/models";
import AppShell from "@renderer/pages/shell";
import TodayPage from "@renderer/pages/today";
import { Navigate, Outlet, Route, Routes } from "react-router";

function PagePad(): React.JSX.Element {
  return (
    <div className="px-12 py-9">
      <Outlet />
    </div>
  );
}

export default function App(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/today" replace />} />
      <Route path="/app" element={<AppPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />

      <Route element={<AppShell />}>
        <Route path="/today" element={<TodayPage />} />
        <Route element={<PagePad />}>
          <Route path="/settings" element={<GeneralSettingsPage />} />
          <Route path="/settings/models" element={<ModelsPage />} />
          <Route path="/settings/dictionary" element={<DictionaryPage />} />
          <Route path="/settings/formats" element={<FormatsPage />} />
          <Route path="/settings/history" element={<HistoryPage />} />
          <Route path="/settings/feedback" element={<FeedbackPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
