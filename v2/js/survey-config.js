// Field survey questions (customer profile & journey research).
// type: one = pick one, many = pick several (max = limit), text = short answer, long = notes.
// ord: true keeps the option order in charts (budgets, durations); otherwise charts sort by count.
// private: shown in Responses only, never in the dashboard.
(function () {
  var AREAS = ['Kilimani', 'Kileleshwa', 'Lavington', 'Parklands', 'South C', 'Westlands', 'Other'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  window.VS_SURVEY = {
    targets: { fam: 20, ind: 10 },
    fam: { label: 'Family', sections: [
      { title: 'About them', tag: 'Profile', qs: [
        { id: 'f_seg', t: 'Which describes them best?', type: 'one', o: ['Young family in Nairobi', 'Relocating from upcountry', 'Relocating from abroad (diaspora)', 'Other'] },
        { id: 'f_size', t: 'People in the household', type: 'one', ord: true, o: ['2', '3', '4', '5', '6+'] },
        { id: 'f_kids', t: 'Children', type: 'one', ord: true, o: ['None', '1', '2', '3+'] },
        { id: 'f_now', t: 'Where do they live now?', type: 'text', ph: 'Area or town' },
        { id: 'f_want', t: 'Areas they would consider', type: 'many', o: AREAS },
        { id: 'f_beds', t: 'Bedrooms they need', type: 'one', ord: true, o: ['1 bed', '2 bed', '3 bed', '4+ bed'] },
        { id: 'f_budget', t: 'Monthly rent budget (KES)', type: 'one', ord: true, o: ['Under 40k', '40k–60k', '60k–80k', '80k–100k', '100k–150k', '150k+'] },
        { id: 'f_decider', t: 'Who makes the final decision on the house?', type: 'one', o: ['Mother', 'Father', 'Both together', 'Another relative', 'Employer'] },
        { id: 'f_must', t: 'Top 3 must-haves', type: 'many', max: 3, o: ['Schools nearby', 'Water 24/7', 'Security', 'Parking', 'Backup power', 'Lift', 'Space for kids to play', 'Near mosque or church', 'Near work', 'Furnished', 'Quiet compound'] }
      ] },
      { title: 'Their last house hunt', tag: 'Journey', qs: [
        { id: 'j_why', t: 'Why did they move last time?', type: 'one', o: ['Needed more space', 'Cheaper rent', 'Closer to school or work', 'New to Nairobi', 'Problem with landlord or building', 'Other'] },
        { id: 'j_season', t: 'When do families like them usually move?', type: 'one', ord: true, o: ['Dec–Jan', 'Apr–May', 'Aug–Sep', 'Any time'] },
        { id: 'j_weeks', t: 'How long did the search take?', type: 'one', ord: true, o: ['Under 1 week', '1–2 weeks', '2–4 weeks', '1–2 months', 'Over 2 months'] },
        { id: 'j_channels', t: 'How did they look for houses?', type: 'many', o: ['Agent', 'Caretaker at the gate', 'Friends or family', 'WhatsApp groups', 'Facebook', 'TikTok or Instagram', 'Property websites', 'Jiji', 'Drove around looking'] },
        { id: 'j_viewed', t: 'How many houses did they view?', type: 'one', ord: true, o: ['1–3', '4–6', '7–10', 'More than 10'] },
        { id: 'j_who', t: 'Who went to the viewings?', type: 'one', o: ['Both parents', 'One parent', 'A relative or friend for them', 'An agent for them'] },
        { id: 'j_pains', t: 'What went wrong or wasted time?', type: 'many', o: ['Fake or outdated listings', "Photos didn't match", 'Viewing money asked upfront', 'Wasted transport', 'Hard to compare houses', 'Caretaker or landlord unreachable', 'Hidden costs (deposit, water, service charge)', 'Scammed or lost money', 'Moving day problems'] },
        { id: 'j_paid', t: 'What did they pay agents?', type: 'one', o: ['Nothing', 'Viewing fees only', 'Commission only', 'Viewing fees and commission'] },
        { id: 'j_paidamt', t: 'Roughly how much in total? (KES)', type: 'text', ph: 'e.g. 1,500 viewing + 10,000 commission' },
        { id: 'j_decide', t: 'What made them choose the house they took? (up to 2)', type: 'many', max: 2, o: ['Price', 'Location or school', 'Security', 'Condition of the house', 'Caretaker or landlord attitude', 'Gut feeling'] },
        { id: 'j_story', t: 'Worst moment of the search, in their words', type: 'long' }
      ] },
      { title: 'The Viustay offer', tag: 'Test', qs: [
        { id: 'v_fee', t: 'KES 950 per viewing trip plus the taxi: how does that sound?', type: 'one', o: ['Fair', 'Fair only if homes are verified', 'Too high', 'Would not pay'] },
        { id: 'v_place', t: "10% of one month's rent once they move in?", type: 'one', o: ['Fair', 'Would pay more for full service', 'Too high', 'Would not pay'] },
        { id: 'v_trust', t: 'What would make them trust a new company like Viustay?', type: 'many', o: ['Real verified photos', 'Video tour', 'Reviews from tenants', 'Referral from someone they know', 'Registered company', "Refund if the house isn't as shown"] },
        { id: 'v_contact', t: 'How should we reach them?', type: 'one', o: ['WhatsApp', 'Phone call', 'SMS', 'Email'] },
        { id: 'v_notes', t: 'Anything else they said', type: 'long' }
      ] }
    ] },
    ind: { label: 'Industry', sections: [
      { title: 'Who they are', tag: 'Profile', qs: [
        { id: 'i_role', t: 'Their role', type: 'one', o: ['Agent', 'Caretaker', 'Property manager', 'Landlord'] },
        { id: 'i_area', t: 'Areas they cover', type: 'many', o: AREAS },
        { id: 'i_units', t: 'How many units do they handle?', type: 'one', ord: true, o: ['1–10', '11–30', '31–100', '100+'] },
        { id: 'i_types', t: 'Unit types', type: 'many', o: ['Bedsitter or studio', '1 bed', '2 bed', '3 bed', '4+ bed', 'Furnished or short stay'] }
      ] },
      { title: 'Their tenants', tag: 'Market', qs: [
        { id: 'i_who', t: 'Who rents from them most?', type: 'many', o: ['Young professionals', 'Young families', 'Families relocating', 'Students', 'Diaspora', 'Short-stay guests'] },
        { id: 'i_vacancy', t: 'How long does a vacant unit stay empty?', type: 'one', ord: true, o: ['Under 1 week', '1–2 weeks', '2–4 weeks', '1–2 months', 'Over 2 months'] },
        { id: 'i_find', t: 'How do tenants find them?', type: 'many', o: ['Sign at the gate', 'Agents', 'Referrals', 'WhatsApp groups', 'Facebook', 'Property websites', 'TikTok or Instagram'] },
        { id: 'i_peak', t: 'Busiest months', type: 'many', ord: true, months: true, o: MONTHS },
        { id: 'i_journey', t: "Steps from a tenant's first call to move-in, in their words", type: 'long' }
      ] },
      { title: 'Money and problems', tag: 'Deal', qs: [
        { id: 'i_tenantfee', t: 'What tenants usually pay agents', type: 'text', ph: 'e.g. KES 1,000 viewing, 50% of rent' },
        { id: 'i_landfee', t: 'What buildings pay agents', type: 'text', ph: "e.g. half a month's rent per tenant" },
        { id: 'i_pains', t: 'Their biggest problems', type: 'many', o: ['Unserious viewers', 'Late rent', 'Tenants leaving early', 'Agents bringing the wrong clients', 'Too many agents', 'Damage at move-out', 'Hard to reach the owner'] },
        { id: 'i_interest', t: 'Would they work with Viustay?', type: 'one', o: ['Yes, ready now', 'Interested, needs details', 'Not now', 'No'] },
        { id: 'i_contact', t: 'Name and phone (only with their OK)', type: 'text', ph: 'Shown only in Responses', private: true },
        { id: 'i_notes', t: 'Anything else they said', type: 'long' }
      ] }
    ] }
  };
})();
