import AdminCalendar from './pages/AdminCalendar';
import AdminWeddings from './pages/AdminWeddings';
import Home from './pages/Home';
import SuperAdmin from './pages/SuperAdmin';
import Dashboard from './pages/Dashboard';
import VenueSettings from './pages/VenueSettings';


export const PAGES = {
    "AdminCalendar": AdminCalendar,
    "AdminWeddings": AdminWeddings,
    "Home": Home,
    "SuperAdmin": SuperAdmin,
    "Dashboard": Dashboard,
    "VenueSettings": VenueSettings,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};