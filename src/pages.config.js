import AdminBudgetEstimates from './pages/AdminBudgetEstimates';
import AdminCalendar from './pages/AdminCalendar';
import AdminPhotos from './pages/AdminPhotos';
import AdminWeddings from './pages/AdminWeddings';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import SuperAdmin from './pages/SuperAdmin';
import VenueSettings from './pages/VenueSettings';
import AdminVisualizerSettings from './pages/AdminVisualizerSettings';


export const PAGES = {
    "AdminBudgetEstimates": AdminBudgetEstimates,
    "AdminCalendar": AdminCalendar,
    "AdminPhotos": AdminPhotos,
    "AdminWeddings": AdminWeddings,
    "Dashboard": Dashboard,
    "Home": Home,
    "SuperAdmin": SuperAdmin,
    "VenueSettings": VenueSettings,
    "AdminVisualizerSettings": AdminVisualizerSettings,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};