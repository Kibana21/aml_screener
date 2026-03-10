"""Parser for Nice Actimize Watchlist Filtering XML alert files."""

import xml.etree.ElementTree as ET
from pathlib import Path

from models.schemas import Alert, HitAlias, HitInfo, Party, PartyAddress, PartyId


def _get_elem_text(parent: ET.Element, name: str) -> str:
    """Get text of a child <elem name='...'> element."""
    for elem in parent:
        if elem.attrib.get("name") == name:
            return (elem.text or "").strip()
    return ""


def _get_all_elems(parent: ET.Element, name: str) -> list[ET.Element]:
    """Get all child <elem name='...'> elements with a given name."""
    return [e for e in parent if e.attrib.get("name") == name]


def parse_alert_xml(xml_path: str | Path) -> Alert:
    """Parse a single Nice Actimize alert XML file into an Alert model."""
    # Nice Actimize XMLs may declare UTF16 encoding but actually be UTF-8.
    # Read as text and strip the XML declaration to avoid encoding errors.
    raw = Path(xml_path).read_text(encoding="utf-8")
    if raw.startswith("<?xml"):
        raw = raw[raw.index("?>") + 2:]
    root = ET.fromstring(raw)

    header = root.find("alert-header")
    if header is None:
        raise ValueError(f"No alert-header found in {xml_path}")

    # Parse alert header metadata
    alert_id = _get_elem_text(header, "alertId")
    alert_date = _get_elem_text(header, "alertDate")
    score_str = _get_elem_text(header, "score")
    score = float(score_str) if score_str else 0.0

    # Parse ahData fields
    job_name = ""
    job_type = ""
    number_of_hits = 0
    for ah in _get_all_elems(header, "ahData"):
        jn = _get_elem_text(ah, "jobName")
        if jn:
            job_name = jn
        jt = _get_elem_text(ah, "jobType")
        if jt:
            job_type = jt
        nh = _get_elem_text(ah, "numberOfHits")
        if nh:
            number_of_hits = int(nh)

    # Parse party data
    party = Party(
        party_key=_get_elem_text(header, "alertEntityKey"),
        name=_get_ah_data_value(header, "partyName"),
        dob=_get_elem_text(header, "partyDOB") or None,
        yob=_safe_int(_get_elem_text(header, "partyYOB")),
        birth_country=_get_elem_text(header, "partyBirthCountry"),
        birth_location=_get_elem_text(header, "partyBirthLocation"),
        gender=_get_elem_text(header, "partyGender"),
        party_type=_get_elem_text(header, "partyType"),
    )

    # Parse party IDs
    for pid_elem in _get_all_elems(header, "partyIds"):
        party.ids.append(PartyId(
            id_type=_get_elem_text(pid_elem, "idType"),
            id_number=_get_elem_text(pid_elem, "idNumber"),
            id_country=_get_elem_text(pid_elem, "idCountry"),
        ))

    # Parse nationalities
    for nat_elem in _get_all_elems(header, "partyNatCountries"):
        code = _get_elem_text(nat_elem, "countryCd")
        if code and code not in ("A", ""):
            party.nationalities.append(code)

    # Parse addresses
    for addr_elem in _get_all_elems(header, "partyAddresses"):
        party.addresses.append(PartyAddress(
            line1=_get_elem_text(addr_elem, "partyAddressLine1"),
            line2=_get_elem_text(addr_elem, "partyAddressLine2"),
            city=_get_elem_text(addr_elem, "partyCity"),
            postal_code=_get_elem_text(addr_elem, "partyPostalCd"),
            state_province=_get_elem_text(addr_elem, "partyStateProvince"),
            country=_get_elem_text(addr_elem, "partyCountry"),
        ))

    # Parse hits
    hits_section = root.find("hits")
    hits: list[HitInfo] = []
    if hits_section is not None:
        for hit_elem in _get_all_elems(hits_section, "hit"):
            hit = _parse_hit(hit_elem)
            hits.append(hit)

    return Alert(
        alert_id=alert_id,
        alert_date=alert_date,
        score=score,
        job_name=job_name,
        job_type=job_type,
        number_of_hits=number_of_hits,
        source_file=Path(xml_path).stem,
        party=party,
        hits=hits,
    )


def _parse_hit(hit_elem: ET.Element) -> HitInfo:
    """Parse a single hit element."""
    # Parse aliases
    aliases: list[HitAlias] = []
    for alias_elem in _get_all_elems(hit_elem, "aliases"):
        aliases.append(HitAlias(
            display_name=_get_elem_text(alias_elem, "displayName"),
            matched_name=_get_elem_text(alias_elem, "matchedName"),
            match_strength=_get_elem_text(alias_elem, "matchStrength"),
        ))

    # Parse nationalities
    nationalities: list[str] = []
    for nat_elem in _get_all_elems(hit_elem, "nationalityCountries"):
        country = _get_elem_text(nat_elem, "country")
        if country:
            nationalities.append(country)

    # Parse categories
    categories: list[str] = []
    for cat_elem in _get_all_elems(hit_elem, "categories"):
        cat = _get_elem_text(cat_elem, "category")
        if cat:
            categories.append(cat)

    # Parse additional info
    additional_info: dict[str, str] = {}
    for info_elem in _get_all_elems(hit_elem, "additionalInfo"):
        name = _get_elem_text(info_elem, "name")
        value = _get_elem_text(info_elem, "value")
        if name:
            additional_info[name] = value

    score_str = _get_elem_text(hit_elem, "score")

    return HitInfo(
        list_id=_get_elem_text(hit_elem, "listId"),
        entry_id=_get_elem_text(hit_elem, "entryId"),
        entry_type=_get_elem_text(hit_elem, "entryType"),
        matched_name=_get_elem_text(hit_elem, "matchedName"),
        display_name=_get_elem_text(hit_elem, "displayName"),
        aliases=aliases,
        nationalities=nationalities,
        age=_get_elem_text(hit_elem, "age") or None,
        categories=categories,
        title=_get_elem_text(hit_elem, "title"),
        position=_get_elem_text(hit_elem, "position"),
        gender=_get_elem_text(hit_elem, "gender"),
        is_deceased=_get_elem_text(hit_elem, "isDeceased").upper() == "TRUE",
        deceased_date=_get_elem_text(hit_elem, "deceasedDate") or None,
        additional_info=additional_info,
        score=float(score_str) if score_str else 0.0,
        match_type=_get_elem_text(hit_elem, "matchType"),
    )


def _get_ah_data_value(header: ET.Element, field_name: str) -> str:
    """Get a value from ahData elements."""
    for ah in _get_all_elems(header, "ahData"):
        val = _get_elem_text(ah, field_name)
        if val:
            return val
    return ""


def _safe_int(val: str) -> int | None:
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def parse_all_alerts(data_dir: str | Path) -> list[Alert]:
    """Parse all XML alert files in a directory."""
    data_path = Path(data_dir)
    alerts = []
    for xml_file in sorted(data_path.glob("alert_*.xml")):
        alert = parse_alert_xml(xml_file)
        alerts.append(alert)
    return alerts
