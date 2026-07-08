Style Guide Document
Editexpand
Download
Copy
Color Palette
Type	Name	Hex	Usage	Contrast Compliant
primary	Primary Blue	#1A73E8	Primary actions, buttons, links, and key interactive elements. Used for CTA buttons like Register, Login, Verify OTP.	true
secondary	Secondary Teal	#00897B	Secondary actions, supporting elements, and success states. Used for confirmation messages and secondary buttons.	true
accent	Accent Orange	#FF6D00	Highlights, warnings, and attention-grabbing elements. Used for OTP expiry warnings and important notifications.	true
background	Background White	#FFFFFF	Primary background for screens, cards, and content areas. Ensures clean, readable interface.	true
text	Text Dark	#212121	Primary text color for headings, body text, and labels. Ensures high readability.	true
additional_colors	Error Red	#D32F2F	Error messages, validation errors, and destructive actions like Account Deletion confirmation.	true
additional_colors	Success Green	#388E3C	Success messages, verified states, and positive feedback indicators.	true
additional_colors	Warning Yellow	#FBC02D	Warning messages, OTP expiry alerts, and cautionary notifications.	true
additional_colors	Disabled Gray	#9E9E9E	Disabled buttons, inactive states, and placeholder text.	true
additional_colors	Surface Light Gray	#F5F5F5	Secondary backgrounds, input field backgrounds, and card surfaces.	true
additional_colors	Border Gray	#E0E0E0	Input field borders, dividers, and subtle separators.	true
Typography
Styles
Role	Font Family	Font Size	Font Weight	Line Height	Letter Spacing	Usage	Min Size
Heading 1	Inter, SF Pro Display, Roboto, sans-serif	32px	700	40px	-0.5px	Main page titles such as Landing Screen hero headline, Dashboard title.	28px
Heading 2	Inter, SF Pro Display, Roboto, sans-serif	24px	600	32px	-0.25px	Section headers, screen titles like Registration, Login, OTP Verification.	20px
Heading 3	Inter, SF Pro Display, Roboto, sans-serif	20px	600	28px	0px	Subsection headers, card titles, feature overview headers.	18px
Body Large	Inter, SF Pro Text, Roboto, sans-serif	16px	400	24px	0px	Primary body text, form labels, descriptions, and paragraphs.	14px
Body Regular	Inter, SF Pro Text, Roboto, sans-serif	14px	400	20px	0px	Secondary body text, helper text, input placeholders.	12px
Caption	Inter, SF Pro Text, Roboto, sans-serif	12px	400	16px	0.25px	Captions, timestamps, OTP expiry messages, footnotes.	11px
Button Text	Inter, SF Pro Text, Roboto, sans-serif	14px	600	20px	0.5px	Button labels for Register, Login, Verify, Delete Account actions.	14px
Link Text	Inter, SF Pro Text, Roboto, sans-serif	14px	500	20px	0px	Navigation links, Forgot Password link, Resend OTP option.	14px
Components
Name	Description	Usage	States	Cross Platform Notes
Primary Button	Main call-to-action button used for primary actions such as Register, Login, Verify OTP.	Use for the most important action on a screen. Only one primary button per screen section.	[{"background_color":"#1A73E8","border_color":"transparent","text_color":"#FFFFFF","shadow":"0px 2px 4px rgba(0, 0, 0, 0.1)","icon_color":"#FFFFFF","state_name":"Default"},{"background_color":"#1557B0","border_color":"transparent","text_color":"#FFFFFF","shadow":"0px 4px 8px rgba(0, 0, 0, 0.15)","icon_color":"#FFFFFF","state_name":"Hover"},{"background_color":"#1A73E8","border_color":"#000000","text_color":"#FFFFFF","shadow":"0px 0px 0px 3px rgba(26, 115, 232, 0.4)","icon_color":"#FFFFFF","state_name":"Focus"},{"background_color":"#0D47A1","border_color":"transparent","text_color":"#FFFFFF","shadow":"none","icon_color":"#FFFFFF","state_name":"Active/Pressed"},{"background_color":"#E0E0E0","border_color":"transparent","text_color":"#9E9E9E","shadow":"none","icon_color":"#9E9E9E","state_name":"Disabled"}]	iOS: Use system haptic feedback on tap. Android: Implement ripple effect. Web: Ensure 44px minimum touch target on mobile viewports.
Secondary Button	Supporting action button for secondary actions like Cancel, Back, or Resend OTP.	Use alongside primary buttons for alternative actions. Should not compete visually with primary button.	[{"background_color":"transparent","border_color":"#1A73E8","text_color":"#1A73E8","shadow":"none","icon_color":"#1A73E8","state_name":"Default"},{"background_color":"rgba(26, 115, 232, 0.08)","border_color":"#1557B0","text_color":"#1557B0","shadow":"none","icon_color":"#1557B0","state_name":"Hover"},{"background_color":"transparent","border_color":"#1A73E8","text_color":"#1A73E8","shadow":"0px 0px 0px 3px rgba(26, 115, 232, 0.4)","icon_color":"#1A73E8","state_name":"Focus"},{"background_color":"transparent","border_color":"#E0E0E0","text_color":"#9E9E9E","shadow":"none","icon_color":"#9E9E9E","state_name":"Disabled"}]	Maintain consistent border width (1.5px) across platforms. Use outline style on all platforms.
Destructive Button	Button for destructive actions like Delete Account that require user confirmation.	Use sparingly for irreversible actions. Always pair with confirmation dialog.	[{"background_color":"#D32F2F","border_color":"transparent","text_color":"#FFFFFF","shadow":"0px 2px 4px rgba(0, 0, 0, 0.1)","icon_color":"#FFFFFF","state_name":"Default"},{"background_color":"#B71C1C","border_color":"transparent","text_color":"#FFFFFF","shadow":"0px 4px 8px rgba(0, 0, 0, 0.15)","icon_color":"#FFFFFF","state_name":"Hover"},{"background_color":"#D32F2F","border_color":"#000000","text_color":"#FFFFFF","shadow":"0px 0px 0px 3px rgba(211, 47, 47, 0.4)","icon_color":"#FFFFFF","state_name":"Focus"},{"background_color":"#E0E0E0","border_color":"transparent","text_color":"#9E9E9E","shadow":"none","icon_color":"#9E9E9E","state_name":"Disabled"}]	Always require confirmation before executing destructive action. Use system alert dialogs on mobile platforms.
Text Input Field	Standard input field for collecting user data such as Name, Email, Password, and OTP.	Use for all form inputs. Include clear labels, placeholder text, and validation feedback.	[{"background_color":"#FFFFFF","border_color":"#E0E0E0","text_color":"#212121","shadow":"none","icon_color":"#9E9E9E","state_name":"Default"},{"background_color":"#FFFFFF","border_color":"#1A73E8","text_color":"#212121","shadow":"0px 0px 0px 3px rgba(26, 115, 232, 0.2)","icon_color":"#1A73E8","state_name":"Focus"},{"background_color":"#FFFFFF","border_color":"#9E9E9E","text_color":"#212121","shadow":"none","icon_color":"#212121","state_name":"Filled"},{"background_color":"#FFFFFF","border_color":"#D32F2F","text_color":"#212121","shadow":"none","icon_color":"#D32F2F","state_name":"Error"},{"background_color":"#F5F5F5","border_color":"#E0E0E0","text_color":"#9E9E9E","shadow":"none","icon_color":"#9E9E9E","state_name":"Disabled"}]	iOS: Use native UITextField with custom styling. Android: Use Material TextInputLayout. Web: Ensure 48px minimum height for touch accessibility.
Password Input Field	Secure input field for password entry with visibility toggle.	Use for password fields in Registration and Login screens. Always include show/hide toggle icon.	[{"background_color":"#FFFFFF","border_color":"#E0E0E0","text_color":"#212121","shadow":"none","icon_color":"#9E9E9E","state_name":"Default"},{"background_color":"#FFFFFF","border_color":"#1A73E8","text_color":"#212121","shadow":"0px 0px 0px 3px rgba(26, 115, 232, 0.2)","icon_color":"#1A73E8","state_name":"Focus"},{"background_color":"#FFFFFF","border_color":"#D32F2F","text_color":"#212121","shadow":"none","icon_color":"#D32F2F","state_name":"Error"}]	Implement secure text entry by default. Toggle icon should be clearly tappable with 44px touch target.
OTP Input Field	Specialized input for OTP verification with individual digit boxes.	Use on OTP Verification Screen. Display 6 separate input boxes for each digit.	[{"background_color":"#FFFFFF","border_color":"#E0E0E0","text_color":"#212121","shadow":"none","icon_color":null,"state_name":"Default"},{"background_color":"#FFFFFF","border_color":"#1A73E8","text_color":"#212121","shadow":"0px 0px 0px 2px rgba(26, 115, 232, 0.3)","icon_color":null,"state_name":"Focus"},{"background_color":"#F5F5F5","border_color":"#1A73E8","text_color":"#212121","shadow":"none","icon_color":null,"state_name":"Filled"},{"background_color":"#FFFFFF","border_color":"#D32F2F","text_color":"#D32F2F","shadow":"none","icon_color":null,"state_name":"Error"}]	Auto-advance to next field on input. Support paste functionality for full OTP. Display countdown timer for 5-minute expiry.
Card	Container component for grouping related content such as forms, feature overviews, and summary widgets.	Use on Landing Screen for feature overview, Dashboard for summary widgets, and form containers.	[{"background_color":"#FFFFFF","border_color":"#E0E0E0","text_color":"#212121","shadow":"0px 2px 8px rgba(0, 0, 0, 0.08)","icon_color":"#212121","state_name":"Default"},{"background_color":"#FFFFFF","border_color":"#E0E0E0","text_color":"#212121","shadow":"0px 4px 16px rgba(0, 0, 0, 0.12)","icon_color":"#212121","state_name":"Hover"}]	Use consistent border-radius of 8px across platforms. Maintain 16px internal padding.
Navigation Link	Text-based navigation element for moving between screens.	Use in navigation bar, footer, and inline links like Forgot Password.	[{"background_color":"transparent","border_color":"transparent","text_color":"#1A73E8","shadow":"none","icon_color":"#1A73E8","state_name":"Default"},{"background_color":"transparent","border_color":"transparent","text_color":"#1557B0","shadow":"none","icon_color":"#1557B0","state_name":"Hover"},{"background_color":"rgba(26, 115, 232, 0.08)","border_color":"transparent","text_color":"#1A73E8","shadow":"0px 0px 0px 2px rgba(26, 115, 232, 0.4)","icon_color":"#1A73E8","state_name":"Focus"},{"background_color":"transparent","border_color":"transparent","text_color":"#0D47A1","shadow":"none","icon_color":"#0D47A1","state_name":"Active"}]	Underline on hover for web. Use system link styling conventions on mobile platforms.
Modal/Dialog	Overlay component for confirmations, alerts, and focused interactions.	Use for Account Deletion confirmation, error alerts, and important notifications.	[{"background_color":"#FFFFFF","border_color":"transparent","text_color":"#212121","shadow":"0px 8px 32px rgba(0, 0, 0, 0.24)","icon_color":"#212121","state_name":"Default"}]	iOS: Use UIAlertController or custom modal. Android: Use Material Dialog. Web: Implement focus trap and escape key dismissal.
Alert/Toast	Notification component for success, error, warning, and info messages.	Use for registration success, OTP sent confirmation, login errors, and validation messages.	[{"background_color":"#E8F5E9","border_color":"#388E3C","text_color":"#1B5E20","shadow":"0px 2px 8px rgba(0, 0, 0, 0.1)","icon_color":"#388E3C","state_name":"Success"},{"background_color":"#FFEBEE","border_color":"#D32F2F","text_color":"#B71C1C","shadow":"0px 2px 8px rgba(0, 0, 0, 0.1)","icon_color":"#D32F2F","state_name":"Error"},{"background_color":"#FFF8E1","border_color":"#FBC02D","text_color":"#F57F17","shadow":"0px 2px 8px rgba(0, 0, 0, 0.1)","icon_color":"#FBC02D","state_name":"Warning"},{"background_color":"#E3F2FD","border_color":"#1A73E8","text_color":"#0D47A1","shadow":"0px 2px 8px rgba(0, 0, 0, 0.1)","icon_color":"#1A73E8","state_name":"Info"}]	Auto-dismiss after 5 seconds for non-critical messages. Persist error messages until user dismisses.
Navigation Bar	Top navigation component for primary app navigation and branding.	Use on all screens for consistent navigation. Include logo, navigation links, and auth actions.	[{"background_color":"#FFFFFF","border_color":"#E0E0E0","text_color":"#212121","shadow":"0px 2px 4px rgba(0, 0, 0, 0.08)","icon_color":"#212121","state_name":"Default"}]	Fixed position on scroll. Collapse to hamburger menu on mobile viewports below 768px.
Summary Widget	Dashboard component displaying key metrics and quick actions.	Use on Dashboard Screen for user summary data and quick access to features.	[{"background_color":"#FFFFFF","border_color":"#E0E0E0","text_color":"#212121","shadow":"0px 2px 8px rgba(0, 0, 0, 0.08)","icon_color":"#1A73E8","state_name":"Default"}]	Stack vertically on mobile. Display in grid on tablet and desktop.
Navigation Bars
Name: Desktop Navigation Bar
Ascii Wireframe
+-----------------------------------------------------------------------------------+
|  [Logo]     [Home]    [Features]    [About]         [Sign In]  [Register Button] |
+-----------------------------------------------------------------------------------+

Structure:
- Logo: Left-aligned, clickable to Landing Screen
- Navigation Links: Center-aligned horizontal menu
  - Home → Landing Screen
  - Features → Landing Screen (anchor)
  - About → Landing Screen (anchor)
- Auth Actions: Right-aligned
  - Sign In → Login Screen (text link)
  - Register → Registration Screen (primary button)
Name: Desktop Navigation Bar (Authenticated)
Ascii Wireframe
+-----------------------------------------------------------------------------------+
|  [Logo]     [Dashboard]    [Account]              [User Icon]  [Logout Button]   |
+-----------------------------------------------------------------------------------+

Structure:
- Logo: Left-aligned, clickable to Dashboard
- Navigation Links: Center-aligned
  - Dashboard → Dashboard Screen
  - Account → Account Deletion Screen
- User Section: Right-aligned
  - User Icon with dropdown
  - Logout Button (secondary style)
Name: Mobile Navigation Bar (Collapsed)
Ascii Wireframe
+---------------------------------------+
|  [Logo]                [Hamburger ☰]  |
+---------------------------------------+

Expanded Menu (overlay):
+---------------------------------------+
|  [×] Close                            |
+---------------------------------------+
|  [Home]                               |
|  [Features]                           |
|  [About]                              |
+---------------------------------------+
|  [Sign In]                            |
|  [Register Button]                    |
+---------------------------------------+
Name: Mobile Navigation Bar (Authenticated)
Ascii Wireframe
+---------------------------------------+
|  [Logo]                [Hamburger ☰]  |
+---------------------------------------+

Expanded Menu (overlay):
+---------------------------------------+
|  [×] Close                            |
+---------------------------------------+
|  [Dashboard]                          |
|  [Account]                            |
+---------------------------------------+
|  [User Email Display]                 |
|  [Logout Button]                      |
+---------------------------------------+
Name: Mobile Bottom Tab Bar (Authenticated - Alternative)
Ascii Wireframe
+---------------------------------------+
|                                       |
|           [ Screen Content ]          |
|                                       |
+---------------------------------------+
| [🏠 Home] | [👤 Account] | [🚪 Logout]|
+---------------------------------------+

Structure:
- Home Icon → Dashboard Screen
- Account Icon → Account Settings/Deletion
- Logout Icon → Logout Action
Footer
Name: Desktop Footer
Ascii Wireframe
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [Logo]                                                                           |
|                                                                                   |
|  Quick Links          Support              Legal                  Connect         |
|  -----------          -------              -----                  -------         |
|  [Home]               [Help Center]        [Privacy Policy]       [Twitter Icon]  |
|  [Features]           [Contact Us]         [Terms of Service]     [LinkedIn Icon] |
|  [About]              [FAQ]                [Cookie Policy]        [GitHub Icon]   |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|  © 2024 User Management System. All rights reserved.        [Language Dropdown]   |
+-----------------------------------------------------------------------------------+

Structure:
- Logo: Left-aligned brand identity
- Link Columns: 4-column grid layout
  - Quick Links: Navigation shortcuts
  - Support: Help resources
  - Legal: Compliance documents (GDPR/CCPA)
  - Connect: Social media icons
- Bottom Bar: Copyright notice and language selector
Name: Mobile Footer (Stacked)
Ascii Wireframe
+---------------------------------------+
|                                       |
|              [Logo]                   |
|                                       |
+---------------------------------------+
|  Quick Links                          |
|  [Home] [Features] [About]            |
+---------------------------------------+
|  Support                              |
|  [Help] [Contact] [FAQ]               |
+---------------------------------------+
|  Legal                                |
|  [Privacy] [Terms] [Cookies]          |
+---------------------------------------+
|  Connect                              |
|  [🐦] [💼] [🐙]                        |
+---------------------------------------+
|  © 2024 UMS. All rights reserved.     |
|  [Language Dropdown]                  |
+---------------------------------------+

Structure:
- Vertically stacked sections
- Centered alignment
- Collapsed link groups
- Touch-friendly spacing
Name: Minimal App Footer
Ascii Wireframe
+---------------------------------------+
|  [Privacy] | [Terms] | [Help]         |
|  v1.0.0 • © 2024 UMS                  |
+---------------------------------------+

Structure:
- Essential legal links only
- Version number for mobile apps
- Minimal height to maximize content area
Layouts And Grids
Breakpoints
Device	Min Width	Max Width	Columns	Gutter	Margin
Mobile Small	320px	374px	4	16px	16px
Mobile	375px	767px	4	16px	24px
Tablet	768px	1023px	8	24px	32px
Desktop	1024px	1439px	12	24px	64px
Desktop Large	1440px	none	12	32px	auto (max-width: 1200px)
Spacing Scale
4px (xs)
8px (sm)
12px (md)
16px (base)
24px (lg)
32px (xl)
48px (2xl)
64px (3xl)
96px (4xl)
Rules: Use consistent spacing from the spacing scale. Forms should use 16px vertical spacing between fields. Cards should have 16-24px internal padding. Section spacing should be 48-64px on desktop, 32-48px on mobile. Always maintain 8px grid alignment. Maximum content width of 1200px on large screens. Center-align main content containers.
Iconography And Imagery
Icons
Icon Set: Material Icons or Phosphor Icons (consistent set across platforms)
Size: 24px standard, 20px compact, 16px inline, 32px featured
Color: Inherit from text color or use Primary Blue (#1A73E8) for interactive icons. Use semantic colors for status icons (Success Green, Error Red, Warning Yellow).
Style: Outlined style for consistency. Use filled variants for selected/active states. Maintain 2px stroke weight.
Usage: Use icons to support text labels, not replace them. Ensure all icons have accessible labels. Common icons: email, lock, visibility, check_circle, error, warning, person, logout, delete, menu, close.
Illustrations
Style: Flat, minimal illustrations with limited color palette using primary and accent colors. Friendly and approachable aesthetic.
Allowed Formats
SVG
PNG
Accessibility: Decorative illustrations should have empty alt text. Informative illustrations require descriptive alt text.
Usage: Use on Landing Screen hero section, empty states, and error pages. Keep file sizes optimized for performance.
Images
Style: Professional, clean photography or abstract graphics. Avoid stock photo clichés.
Allowed Formats
WebP
JPEG
PNG
Accessibility: All meaningful images must have descriptive alt text. Use lazy loading for below-fold images.
Usage: Use sparingly. Optimize for web (max 200KB for hero images). Provide 2x resolution for retina displays.
Interaction States
State	Description	Accessibility Considerations
Default	The initial, resting state of an interactive element before any user interaction. Elements should appear clearly interactive through visual affordances like color, borders, or subtle shadows.	Ensure sufficient color contrast (4.5:1 for text, 3:1 for graphical elements). Interactive elements must be visually distinguishable from static content.
Hover	Visual feedback when a cursor is positioned over an interactive element. Apply subtle background color change, shadow elevation, or color darkening to indicate interactivity.	Hover states are not available on touch devices. Never rely solely on hover for critical information. Ensure hover effects don't reduce contrast below WCAG thresholds.
Focus	Visual indicator when an element receives keyboard focus. Display a visible focus ring (3px outline) around the element. Focus must be clearly visible against all backgrounds.	Focus indicator must have minimum 3:1 contrast ratio against adjacent colors. Never remove focus outlines without providing an alternative. Support visible focus for all keyboard-navigable elements.
Active/Pressed	Visual feedback during the moment of interaction (click/tap). Apply darker background color and remove shadow to simulate physical press. Duration should be brief (100-150ms).	Provide immediate visual feedback to confirm interaction. On mobile, consider haptic feedback in addition to visual response.
Disabled	Indicates an element is not currently interactive. Apply reduced opacity (0.5) or gray color scheme. Remove pointer cursor and prevent interaction.	Use aria-disabled attribute. Maintain minimum contrast for disabled text (3:1 recommended). Provide context for why element is disabled when possible.
Error	Indicates invalid input or failed action. Apply Error Red (#D32F2F) to borders and icons. Display error message below the affected element.	Use aria-invalid and aria-describedby to associate error messages. Don't rely solely on color—include error icons and text. Announce errors to screen readers.
Success	Confirms successful completion of an action. Apply Success Green (#388E3C) to borders, icons, or background. Display success message or checkmark icon.	Announce success to screen readers using aria-live regions. Provide clear next steps after successful actions.
Loading	Indicates an action is in progress. Display spinner or progress indicator. Disable the trigger element to prevent duplicate submissions.	Use aria-busy attribute. Announce loading state to screen readers. Provide estimated time for long operations when possible.
Accessibility Guidelines
Key	Value
color_contrast	Maintain minimum 4.5:1 contrast ratio for normal text and 3:1 for large text (18px+ or 14px+ bold) per WCAG 2.1 AA standards. All color combinations in the palette have been verified for compliance. Never convey information through color alone—always pair with text, icons, or patterns.
alt_text	All meaningful images require descriptive alt text that conveys the image's purpose. Decorative images should use empty alt attributes (alt=""). Icons with labels can use aria-hidden. Form input icons should be labeled via aria-label.
keyboard_navigation	All interactive elements must be keyboard accessible. Maintain logical tab order following visual layout. Provide visible focus indicators on all focusable elements. Support standard keyboard patterns: Tab for navigation, Enter/Space for activation, Escape for dismissal, Arrow keys for menu navigation. Implement skip links for main content.
screen_reader	Use semantic HTML elements (button, input, nav, main, form). Provide aria-labels for elements without visible text. Use aria-live regions for dynamic content updates (OTP sent, errors, success messages). Ensure form inputs have associated labels. Use heading hierarchy (h1-h6) correctly.
touch_target	Minimum touch target size of 44x44px for all interactive elements per WCAG 2.1 guidelines. Provide adequate spacing (8px minimum) between touch targets to prevent accidental activation. Larger targets (48x48px) recommended for primary actions.
Usage Guidelines
Key	Value
general	Maintain consistency across all platforms while respecting platform-specific conventions. Use the defined color palette, typography, and component styles without deviation. Follow the spacing scale for all layout decisions. Prioritize accessibility in all implementations. Test on multiple devices and screen sizes.
ios	Follow Apple Human Interface Guidelines alongside this design system. Use SF Pro font family as the primary typeface. Implement native iOS components where appropriate (UIButton, UITextField) with custom styling. Support Dynamic Type for accessibility. Use iOS-specific gestures (swipe, long press) appropriately. Implement haptic feedback for key interactions. Support Dark Mode using semantic colors.
android	Follow Material Design 3 guidelines alongside this design system. Use Roboto font family as the primary typeface. Implement Material components (MaterialButton, TextInputLayout) with custom theming. Support system font scaling. Use Android-specific patterns (FAB, bottom sheets) where appropriate. Implement ripple effects for touch feedback. Support Dark Theme using semantic colors.
web	Follow responsive design principles with mobile-first approach. Ensure cross-browser compatibility (Chrome, Firefox, Safari, Edge). Use CSS custom properties for theming consistency. Implement progressive enhancement. Optimize for performance (lazy loading, code splitting). Support keyboard navigation and screen readers. Test with automated accessibility tools (axe, Lighthouse).
Recommendations
Component	Description
recommendation	Implement a comprehensive design token system using CSS custom properties (web) and platform-specific theming (iOS/Android) to ensure consistent styling and enable easy theme updates across all platforms.
recommendation	Create a shared component library with documented props, states, and usage examples. Consider tools like Storybook for web and similar documentation for mobile platforms.
recommendation	Add Dark Mode support by defining a dark color palette variant. Use semantic color tokens (e.g., --color-surface, --color-on-surface) that automatically adapt to light/dark themes.
recommendation	Implement automated accessibility testing in the CI/CD pipeline using tools like axe-core, Pa11y, or Accessibility Insights to catch issues early in development.
recommendation	Add loading skeleton components for improved perceived performance during data fetching, particularly for the Dashboard summary widgets and any list views.
recommendation	Create an animation and motion guidelines section defining timing curves, durations, and appropriate use of transitions to enhance user experience without causing accessibility issues.
recommendation	Implement a form validation pattern library with consistent error messaging, inline validation, and accessible error announcements for the Registration, Login, and OTP screens.
recommendation	Add password strength indicator component for the Registration screen to guide users in creating secure passwords, aligning with the security requirements.
recommendation	Create empty state and error page designs for scenarios like failed OTP verification, network errors, and session expiration to maintain consistent user experience.
recommendation	Document responsive image guidelines including srcset usage, art direction considerations, and maximum file size recommendations to ensure optimal performance across devices.
recommendation	Add internationalization (i18n) guidelines for text expansion, RTL support, and locale-specific formatting to prepare for potential multi-language support.
recommendation	Implement a notification system design covering in-app notifications, email templates (for OTP delivery), and push notification guidelines for mobile apps.
