import AdminBudgetEstimates from './pages/AdminBudgetEstimates';
import AdminCalendar from './pages/AdminCalendar';
import AdminWeddings from './pages/AdminWeddings';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import SuperAdmin from './pages/SuperAdmin';
import VenueSettings from './pages/VenueSettings';
import AdminPhotos from './pages/AdminPhotos';


export const PAGES = {
    "AdminBudgetEstimates": AdminBudgetEstimates,
    "AdminCalendar": AdminCalendar,
    "AdminWeddings": AdminWeddings,
    "Dashboard": Dashboard,
    "Home": Home,
    "SuperAdmin": SuperAdmin,
    "VenueSettings": VenueSettings,
    "AdminPhotos": AdminPhotos,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};