import AdminBudgetEstimates from './pages/AdminBudgetEstimates';
import AdminCalendar from './pages/AdminCalendar';
import AdminPhotos from './pages/AdminPhotos';
import AdminVisualizerSettings from './pages/AdminVisualizerSettings';
import AdminWeddings from './pages/AdminWeddings';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import MaskGenerator from './pages/MaskGenerator';
import SuperAdmin from './pages/SuperAdmin';
import VenueSettings from './pages/VenueSettings';


export const PAGES = {
    "AdminBudgetEstimates": AdminBudgetEstimates,
    "AdminCalendar": AdminCalendar,
    "AdminPhotos": AdminPhotos,
    "AdminVisualizerSettings": AdminVisualizerSettings,
    "AdminWeddings": AdminWeddings,
    "Dashboard": Dashboard,
    "Home": Home,
    "MaskGenerator": MaskGenerator,
    "SuperAdmin": SuperAdmin,
    "VenueSettings": VenueSettings,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};