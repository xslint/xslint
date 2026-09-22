<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="3.0" expand-text="yes">
  <xsl:template match="/">
    <p>{empty(item)}</p>
    <p>{empty(a[@z &lt; 3])}</p>
    <q><![CDATA[{empty(b[@y < 4])}]]></q>
  </xsl:template>
</xsl:stylesheet>
