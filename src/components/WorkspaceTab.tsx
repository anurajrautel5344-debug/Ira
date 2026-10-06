import React, { useState, useEffect } from 'react';
import {
  googleSignIn,
  logout,
  getAccessToken,
  initAuth,
} from '../lib/auth';
import {
  listDriveFiles,
  createDriveTextFile,
  listGmailMessages,
  sendGmailEmail,
  listCalendarEvents,
  createCalendarEvent,
  listTaskLists,
  listTasks,
  createTask,
  completeTask,
  listSpreadsheets,
  listDocs,
  listSlides,
  listForms,
  listChatSpaces,
  createMeetingSpace,
  listContacts,
} from '../lib/workspace';
import { ConfirmationModal } from './ConfirmationModal';
import {
  Mail,
  Calendar as CalendarIcon,
  HardDrive,
  CheckSquare,
  FileSpreadsheet,
  FileText,
  Presentation,
  Users,
  Video,
  FileQuestion,
  StickyNote,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  ExternalLink,
  Check,
  AlertCircle,
  LogIn,
  LogOut,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { User } from 'firebase/auth';

export const WorkspaceTab: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeSection, setActiveSection] = useState<
    'overview' | 'gmail' | 'calendar' | 'drive' | 'tasks' | 'docs' | 'sheets' | 'contacts' | 'meet'
  >('overview');

  // Loading & error states
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Data states
  const [emails, setEmails] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [sheets, setSheets] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [slides, setSlides] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);

  // Confirmation Modal state for mutating operations
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    details?: string[];
    confirmLabel: string;
    isDestructive?: boolean;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    action: async () => {},
  });
  const [isPerformingAction, setIsPerformingAction] = useState(false);

  // Form states for adding items
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', body: '' });

  const [showEventModal, setShowEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    summary: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    description: '',
  });

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', notes: '' });

  const [showDriveNoteModal, setShowDriveNoteModal] = useState(false);
  const [driveNoteForm, setDriveNoteForm] = useState({ name: 'Ira-Assistant-Note.txt', content: '' });

  const [createdMeetLink, setCreatedMeetLink] = useState<string | null>(null);

  // Check auth on load
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        loadAllWorkspaceData();
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMessage('');
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        loadAllWorkspaceData();
      }
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      setErrorMessage(err.message || 'Failed to sign in with Google');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setEmails([]);
    setEvents([]);
    setDriveFiles([]);
    setTasks([]);
  };

  const loadAllWorkspaceData = async () => {
    setIsLoadingData(true);
    setErrorMessage('');
    try {
      // Fetch core workspace data in parallel with resilient error catchers
      const [emailRes, eventRes, driveRes, taskRes, sheetRes, docRes, contactRes] =
        await Promise.allSettled([
          listGmailMessages(5),
          listCalendarEvents(5),
          listDriveFiles(8),
          listTasks(),
          listSpreadsheets(5),
          listDocs(5),
          listContacts(8),
        ]);

      if (emailRes.status === 'fulfilled') setEmails(emailRes.value || []);
      if (eventRes.status === 'fulfilled') setEvents(eventRes.value.items || []);
      if (driveRes.status === 'fulfilled') setDriveFiles(driveRes.value.files || []);
      if (taskRes.status === 'fulfilled') setTasks(taskRes.value.items || []);
      if (sheetRes.status === 'fulfilled') setSheets(sheetRes.value.files || []);
      if (docRes.status === 'fulfilled') setDocs(docRes.value.files || []);
      if (contactRes.status === 'fulfilled') setContacts(contactRes.value.connections || []);
    } catch (err: any) {
      console.error('Failed to load workspace data:', err);
      setErrorMessage(err.message || 'Error fetching Workspace data');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Safe action executor wrapped in user confirmation dialog
  const executeSafeAction = async () => {
    try {
      setIsPerformingAction(true);
      await confirmModal.action();
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      await loadAllWorkspaceData();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setIsPerformingAction(false);
    }
  };

  // 1. Send Email with Confirmation
  const promptSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.to || !emailForm.subject) return;

    setConfirmModal({
      isOpen: true,
      title: 'Send Email via Gmail?',
      description: `Ira will send this email from your account (${user?.email}) to ${emailForm.to}.`,
      details: [
        `Recipient: ${emailForm.to}`,
        `Subject: ${emailForm.subject}`,
        `Preview: ${emailForm.body.slice(0, 100)}...`,
      ],
      confirmLabel: 'Send Email',
      isDestructive: false,
      action: async () => {
        await sendGmailEmail(emailForm.to, emailForm.subject, emailForm.body);
        setEmailForm({ to: '', subject: '', body: '' });
        setShowEmailComposer(false);
      },
    });
  };

  // 2. Create Calendar Event with Confirmation
  const promptCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.summary) return;

    const start = new Date(`${eventForm.date}T${eventForm.time}:00`).toISOString();
    const endDate = new Date(new Date(`${eventForm.date}T${eventForm.time}:00`).getTime() + 60 * 60 * 1000).toISOString();

    setConfirmModal({
      isOpen: true,
      title: 'Schedule Google Calendar Event?',
      description: `Ira will add this event to your primary Google Calendar.`,
      details: [
        `Event: ${eventForm.summary}`,
        `Date & Time: ${eventForm.date} at ${eventForm.time}`,
      ],
      confirmLabel: 'Schedule Event',
      action: async () => {
        await createCalendarEvent(eventForm.summary, start, endDate, eventForm.description);
        setEventForm({ summary: '', date: new Date().toISOString().split('T')[0], time: '10:00', description: '' });
        setShowEventModal(false);
      },
    });
  };

  // 3. Create Task with Confirmation
  const promptCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title) return;

    setConfirmModal({
      isOpen: true,
      title: 'Add Google Task?',
      description: `Ira will add a new task to your default Google Tasks list.`,
      details: [`Task: ${taskForm.title}`, taskForm.notes ? `Notes: ${taskForm.notes}` : ''].filter(Boolean),
      confirmLabel: 'Create Task',
      action: async () => {
        await createTask('@default', taskForm.title, taskForm.notes);
        setTaskForm({ title: '', notes: '' });
        setShowTaskModal(false);
      },
    });
  };

  // 4. Mark Task Complete with Confirmation
  const promptCompleteTask = (taskId: string, title: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Mark Task as Completed?',
      description: `This will update the status of "${title}" to completed in Google Tasks.`,
      confirmLabel: 'Mark Completed',
      action: async () => {
        await completeTask('@default', taskId);
      },
    });
  };

  // 5. Create Drive Note with Confirmation
  const promptCreateDriveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveNoteForm.name || !driveNoteForm.content) return;

    setConfirmModal({
      isOpen: true,
      title: 'Create File in Google Drive?',
      description: `Ira will save a new file in your personal Google Drive root folder.`,
      details: [`Filename: ${driveNoteForm.name}`],
      confirmLabel: 'Save to Drive',
      action: async () => {
        await createDriveTextFile(driveNoteForm.name, driveNoteForm.content);
        setDriveNoteForm({ name: 'Ira-Assistant-Note.txt', content: '' });
        setShowDriveNoteModal(false);
      },
    });
  };

  // 6. Create Google Meet Space with Confirmation
  const promptCreateMeet = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Create Google Meet Room?',
      description: 'Ira will generate a new Google Meet instant conference link for your account.',
      confirmLabel: 'Create Meeting',
      action: async () => {
        const space = await createMeetingSpace();
        if (space.meetingUri) {
          setCreatedMeetLink(space.meetingUri);
        } else {
          setCreatedMeetLink(`https://meet.google.com/new`);
        }
      },
    });
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto p-4 sm:p-6 overflow-y-auto">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Google Workspace Suite
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Connected 12 Google Workspace services: Drive, Gmail, Calendar, Tasks, Sheets, Docs, Slides, Chat, Forms, Meet, Contacts.
          </p>
        </div>

        {/* Auth State Button */}
        <div>
          {user ? (
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-2xl">
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center text-[10px] text-white">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-left">
                  <p className="text-xs font-semibold text-white leading-tight">
                    {user.displayName || 'Google Account'}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate max-w-[130px]">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1 text-slate-400 hover:text-rose-400 transition ml-1"
                title="Sign out of Google"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Official Google Sign-in Button style */
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold shadow-md active:scale-95 transition disabled:opacity-60"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isLoggingIn ? 'Connecting to Google...' : 'Sign in with Google'}</span>
            </button>
          )}
        </div>
      </div>

      {/* When not logged in: Banner */}
      {!user && (
        <div className="mb-6 p-6 rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-slate-800 text-center">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 mx-auto flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">
            Connect Your Google Workspace
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Sign in with Google to allow Ira to organize files in Drive, view spreadsheets, send emails with your explicit permission, and manage schedule events.
          </p>
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-lg shadow-cyan-900/30 transition active:scale-95"
          >
            <LogIn className="w-4 h-4" />
            <span>Connect Workspace</span>
          </button>
        </div>
      )}

      {/* Navigation Pill Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar text-xs">
        {[
          { id: 'overview', label: 'Overview', icon: ShieldCheck },
          { id: 'gmail', label: 'Gmail', icon: Mail, count: emails.length },
          { id: 'calendar', label: 'Calendar', icon: CalendarIcon, count: events.length },
          { id: 'drive', label: 'Drive', icon: HardDrive, count: driveFiles.length },
          { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: tasks.length },
          { id: 'sheets', label: 'Sheets', icon: FileSpreadsheet, count: sheets.length },
          { id: 'docs', label: 'Docs', icon: FileText, count: docs.length },
          { id: 'contacts', label: 'Contacts', icon: Users, count: contacts.length },
          { id: 'meet', label: 'Google Meet', icon: Video },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap font-medium transition ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-slate-900/70 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}

        {user && (
          <button
            onClick={loadAllWorkspaceData}
            disabled={isLoadingData}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition ml-auto"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* SECTION 1: OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card: Gmail */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                  <Mail className="w-4 h-4" />
                </span>
                <span className="text-[10px] text-slate-400">Gmail</span>
              </div>
              <h4 className="text-sm font-semibold text-white">Recent Emails</h4>
              <p className="text-xs text-slate-400 mt-1">
                {emails.length > 0 ? `${emails.length} messages loaded` : 'Check inbox & compose emails'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <button
                onClick={() => setActiveSection('gmail')}
                className="text-xs text-cyan-400 hover:underline"
              >
                View Emails →
              </button>
              <button
                onClick={() => {
                  setActiveSection('gmail');
                  setShowEmailComposer(true);
                }}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs"
                title="Compose Email"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card: Calendar */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <CalendarIcon className="w-4 h-4" />
                </span>
                <span className="text-[10px] text-slate-400">Google Calendar</span>
              </div>
              <h4 className="text-sm font-semibold text-white">Upcoming Events</h4>
              <p className="text-xs text-slate-400 mt-1">
                {events.length > 0 ? `${events.length} upcoming events` : 'Track upcoming schedules & meetings'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <button
                onClick={() => setActiveSection('calendar')}
                className="text-xs text-cyan-400 hover:underline"
              >
                View Calendar →
              </button>
              <button
                onClick={() => {
                  setActiveSection('calendar');
                  setShowEventModal(true);
                }}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs"
                title="Schedule Event"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card: Drive */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <HardDrive className="w-4 h-4" />
                </span>
                <span className="text-[10px] text-slate-400">Google Drive</span>
              </div>
              <h4 className="text-sm font-semibold text-white">Cloud Files</h4>
              <p className="text-xs text-slate-400 mt-1">
                {driveFiles.length > 0 ? `${driveFiles.length} files available` : 'Browse Drive documents & assets'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <button
                onClick={() => setActiveSection('drive')}
                className="text-xs text-cyan-400 hover:underline"
              >
                Open Drive Files →
              </button>
              <button
                onClick={() => {
                  setActiveSection('drive');
                  setShowDriveNoteModal(true);
                }}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs"
                title="Create Drive Note"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card: Tasks */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <CheckSquare className="w-4 h-4" />
                </span>
                <span className="text-[10px] text-slate-400">Google Tasks</span>
              </div>
              <h4 className="text-sm font-semibold text-white">To-Do List</h4>
              <p className="text-xs text-slate-400 mt-1">
                {tasks.length > 0 ? `${tasks.length} tasks synced` : 'Sync personal reminders & to-dos'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <button
                onClick={() => setActiveSection('tasks')}
                className="text-xs text-cyan-400 hover:underline"
              >
                View Tasks →
              </button>
              <button
                onClick={() => {
                  setActiveSection('tasks');
                  setShowTaskModal(true);
                }}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs"
                title="New Task"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card: Meet */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
                  <Video className="w-4 h-4" />
                </span>
                <span className="text-[10px] text-slate-400">Google Meet</span>
              </div>
              <h4 className="text-sm font-semibold text-white">Instant Meetings</h4>
              <p className="text-xs text-slate-400 mt-1">
                Generate instant meeting rooms with one tap.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <button
                onClick={promptCreateMeet}
                className="text-xs text-teal-400 hover:underline font-medium"
              >
                Start Instant Meet +
              </button>
            </div>
          </div>

          {/* Card: Contacts */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <Users className="w-4 h-4" />
                </span>
                <span className="text-[10px] text-slate-400">Google Contacts</span>
              </div>
              <h4 className="text-sm font-semibold text-white">Address Book</h4>
              <p className="text-xs text-slate-400 mt-1">
                {contacts.length > 0 ? `${contacts.length} contacts found` : 'View contacts & phone numbers'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <button
                onClick={() => setActiveSection('contacts')}
                className="text-xs text-cyan-400 hover:underline"
              >
                View Contacts →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: GMAIL */}
      {activeSection === 'gmail' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-rose-400" />
              Gmail Messages
            </h3>
            <button
              onClick={() => setShowEmailComposer(!showEmailComposer)}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Compose Email</span>
            </button>
          </div>

          {/* Email Composer Form */}
          {showEmailComposer && (
            <form
              onSubmit={promptSendEmail}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wide">
                  Draft New Email
                </h4>
                <button
                  type="button"
                  onClick={() => setShowEmailComposer(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
              <input
                type="email"
                placeholder="Recipient (e.g. colleague@gmail.com)"
                value={emailForm.to}
                onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
              <input
                type="text"
                placeholder="Subject"
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
              <textarea
                placeholder="Message contents..."
                rows={4}
                value={emailForm.body}
                onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send (Confirmation Required)</span>
                </button>
              </div>
            </form>
          )}

          {/* Email List */}
          <div className="space-y-2">
            {emails.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
                No recent emails found or not signed in.
              </div>
            ) : (
              emails.map((email) => (
                <div
                  key={email.id}
                  className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="font-semibold text-white">{email.from}</span>
                    <span>{email.date ? new Date(email.date).toLocaleDateString() : ''}</span>
                  </div>
                  <h4 className="text-xs font-medium text-cyan-200 mb-1">{email.subject}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2">{email.snippet}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: CALENDAR */}
      {activeSection === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-blue-400" />
              Calendar Events
            </h3>
            <button
              onClick={() => setShowEventModal(!showEventModal)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Event</span>
            </button>
          </div>

          {/* Schedule Event Form */}
          {showEventModal && (
            <form
              onSubmit={promptCreateEvent}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                  Schedule New Event
                </h4>
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
              <input
                type="text"
                placeholder="Event Title (e.g., Weekly Sync with Team)"
                value={eventForm.summary}
                onChange={(e) => setEventForm({ ...eventForm, summary: e.target.value })}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <input
                  type="time"
                  value={eventForm.time}
                  onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <textarea
                placeholder="Description / Meeting Notes..."
                rows={2}
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
                >
                  Confirm & Schedule
                </button>
              </div>
            </form>
          )}

          {/* Events List */}
          <div className="space-y-2">
            {events.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
                No upcoming events found.
              </div>
            ) : (
              events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-semibold text-white">{ev.summary}</h4>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span>
                        {ev.start?.dateTime
                          ? new Date(ev.start.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                          : ev.start?.date}
                      </span>
                    </p>
                  </div>
                  {ev.htmlLink && (
                    <a
                      href={ev.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition"
                      title="Open in Google Calendar"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SECTION 4: DRIVE */}
      {activeSection === 'drive' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              Google Drive Files
            </h3>
            <button
              onClick={() => setShowDriveNoteModal(!showDriveNoteModal)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Note in Drive</span>
            </button>
          </div>

          {/* Drive Note Modal */}
          {showDriveNoteModal && (
            <form
              onSubmit={promptCreateDriveNote}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                  Save Note to Google Drive
                </h4>
                <button
                  type="button"
                  onClick={() => setShowDriveNoteModal(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
              <input
                type="text"
                placeholder="Filename (e.g., Ira-Assistant-Note.txt)"
                value={driveNoteForm.name}
                onChange={(e) => setDriveNoteForm({ ...driveNoteForm, name: e.target.value })}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <textarea
                placeholder="Note contents to store in Google Drive..."
                rows={4}
                value={driveNoteForm.content}
                onChange={(e) => setDriveNoteForm({ ...driveNoteForm, content: e.target.value })}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
                >
                  Save to Google Drive
                </button>
              </div>
            </form>
          )}

          {/* Drive Files List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {driveFiles.length === 0 ? (
              <div className="col-span-2 p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
                No Drive files found or not signed in.
              </div>
            ) : (
              driveFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <h4 className="text-xs font-medium text-white truncate">{file.name}</h4>
                    <p className="text-[10px] text-slate-400">
                      Modified {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}
                    </p>
                  </div>
                  {file.webViewLink && (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition shrink-0"
                      title="Open in Drive"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SECTION 5: TASKS */}
      {activeSection === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-amber-400" />
              Google Tasks
            </h3>
            <button
              onClick={() => setShowTaskModal(!showTaskModal)}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Task</span>
            </button>
          </div>

          {/* Task Modal */}
          {showTaskModal && (
            <form
              onSubmit={promptCreateTask}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
                  Add to Google Tasks
                </h4>
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
              <input
                type="text"
                placeholder="Task title (e.g., Prepare report for Ira review)"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <textarea
                placeholder="Optional notes or sub-tasks..."
                rows={2}
                value={taskForm.notes}
                onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium"
                >
                  Add Task
                </button>
              </div>
            </form>
          )}

          {/* Tasks List */}
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
                No active tasks found.
              </div>
            ) : (
              tasks.map((task) => {
                const isCompleted = task.status === 'completed';
                return (
                  <div
                    key={task.id}
                    className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                      isCompleted
                        ? 'bg-slate-950/40 border-slate-900 text-slate-500'
                        : 'bg-slate-900/80 border-slate-800 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => !isCompleted && promptCompleteTask(task.id, task.title)}
                        disabled={isCompleted}
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition ${
                          isCompleted
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                            : 'border-slate-700 hover:border-cyan-400 text-transparent hover:text-cyan-400'
                        }`}
                        title={isCompleted ? 'Completed' : 'Mark task completed'}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <div>
                        <h4
                          className={`text-xs font-medium ${
                            isCompleted ? 'line-through text-slate-500' : 'text-white'
                          }`}
                        >
                          {task.title}
                        </h4>
                        {task.notes && <p className="text-[10px] text-slate-400 mt-0.5">{task.notes}</p>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SECTION 6: SHEETS & DOCS */}
      {(activeSection === 'sheets' || activeSection === 'docs') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {activeSection === 'sheets' ? (
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            ) : (
              <FileText className="w-4 h-4 text-blue-400" />
            )}
            <h3 className="text-base font-semibold text-white capitalize">
              Google {activeSection} Files
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(activeSection === 'sheets' ? sheets : docs).map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between"
              >
                <div className="truncate">
                  <h4 className="text-xs font-medium text-white truncate">{item.name}</h4>
                  <p className="text-[10px] text-slate-400">
                    Modified {item.modifiedTime ? new Date(item.modifiedTime).toLocaleDateString() : ''}
                  </p>
                </div>
                {item.webViewLink && (
                  <a
                    href={item.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 7: MEET */}
      {activeSection === 'meet' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 mx-auto flex items-center justify-center">
            <Video className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Google Meet Instant Rooms</h3>
          <p className="text-xs text-slate-400">
            Generate an instant, secure Google Meet room for your calls and conference syncs.
          </p>
          <button
            onClick={promptCreateMeet}
            className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-lg shadow-teal-900/30 transition active:scale-95"
          >
            Create Instant Meet Link
          </button>
          {createdMeetLink && (
            <div className="p-3 rounded-xl bg-slate-950 border border-teal-500/30 text-xs text-teal-300 flex items-center justify-between">
              <span className="truncate">{createdMeetLink}</span>
              <a
                href={createdMeetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg bg-teal-500 text-slate-950 font-bold shrink-0 ml-2"
              >
                Join Now
              </a>
            </div>
          )}
        </div>
      )}

      {/* SECTION 8: CONTACTS */}
      {activeSection === 'contacts' && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            Google Contacts
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {contacts.length === 0 ? (
              <div className="col-span-full p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
                No contacts loaded.
              </div>
            ) : (
              contacts.map((c, i) => {
                const name = c.names?.[0]?.displayName || 'Unnamed Contact';
                const email = c.emailAddresses?.[0]?.value || '';
                const phone = c.phoneNumbers?.[0]?.value || '';
                const photo = c.photos?.[0]?.url;
                return (
                  <div
                    key={i}
                    className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3"
                  >
                    {photo ? (
                      <img src={photo} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-xs shrink-0">
                        {name.charAt(0)}
                      </div>
                    )}
                    <div className="truncate">
                      <h4 className="text-xs font-semibold text-white truncate">{name}</h4>
                      {email && <p className="text-[10px] text-slate-400 truncate">{email}</p>}
                      {phone && <p className="text-[10px] text-cyan-400 truncate">{phone}</p>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Mutating Action */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        details={confirmModal.details}
        confirmLabel={confirmModal.confirmLabel}
        isDestructive={confirmModal.isDestructive}
        isLoading={isPerformingAction}
        onConfirm={executeSafeAction}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
