import AdminCalendar from './pages/AdminCalendar';
import AdminWeddings from './pages/AdminWeddings';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import SuperAdmin from './pages/SuperAdmin';
import VenueSettings from './pages/VenueSettings';
import AdminBudgetEstimates from './pages/AdminBudgetEstimates';


export const PAGES = {
    "AdminCalendar": AdminCalendar,
    "AdminWeddings": AdminWeddings,
    "Dashboard": Dashboard,
    "Home": Home,
    "SuperAdmin": SuperAdmin,
    "VenueSettings": VenueSettings,
    "AdminBudgetEstimates": AdminBudgetEstimates,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};