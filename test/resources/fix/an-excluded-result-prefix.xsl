<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:foo="urn:foo" exclude-result-prefixes="foo" version="2.0">
  <xsl:output method="xml"/>
  <xsl:template match="/">
    <zz>
      <xsl:value-of select="count(o)"/>
    </zz>
  </xsl:template>
</xsl:stylesheet>
