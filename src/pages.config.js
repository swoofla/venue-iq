import AdminBudgetEstimates from './pages/AdminBudgetEstimates';
import AdminCalendar from './pages/AdminCalendar';
import AdminPhotos from './pages/AdminPhotos';
import AdminVisualizerSettings from './pages/AdminVisualizerSettings';
import AdminWeddings from './pages/AdminWeddings';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import SuperAdmin from './pages/SuperAdmin';
import VenueSettings from './pages/VenueSettings';
import MaskGenerator from './pages/MaskGenerator';


export const PAGES = {
    "AdminBudgetEstimates": AdminBudgetEstimates,
    "AdminCalendar": AdminCalendar,
    "AdminPhotos": AdminPhotos,
    "AdminVisualizerSettings": AdminVisualizerSettings,
    "AdminWeddings": AdminWeddings,
    "Dashboard": Dashboard,
    "Home": Home,
    "SuperAdmin": SuperAdmin,
    "VenueSettings": VenueSettings,
    "MaskGenerator": MaskGenerator,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};