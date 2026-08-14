<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:key name="kk" match="alpha | //beta | //gamma" use="@id"/>
  <xsl:template match="delta | //epsilon">
    <xsl:copy-of select="."/>
  </xsl:template>
</xsl:stylesheet>
