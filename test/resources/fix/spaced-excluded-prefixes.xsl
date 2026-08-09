<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:bar="urn:bar" exclude-result-prefixes = 'bar'>
  <xsl:template match="/">
    <object>
      <xsl:value-of select="bar:label(1 cast as xs:integer)"/>
    </object>
  </xsl:template>
</xsl:stylesheet>
