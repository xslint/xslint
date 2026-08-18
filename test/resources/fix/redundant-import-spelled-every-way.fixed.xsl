<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:include href="c.xsl"/>
  <!-- pinned -->
  <xsl:include href="a&amp;b.xsl"/>
  <xsl:import href="common.xsl"/>
  <xsl:template match="/">
    <xsl:value-of select="."/>
  </xsl:template>
</xsl:stylesheet>
